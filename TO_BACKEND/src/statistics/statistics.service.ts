// ============================================================
// src/statistics/statistics.service.ts — PRODUCTION FIXED
// ============================================================
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SaleEntity, SaleStatus } from "../sale/entities/sale.entity";
import { PaymentEntity, PaymentMethod } from "../payments/entities/payment.entity";
import { DebtEntity, DebtStatus } from "../debts/entities/debt.entity";
import { ProductEntity } from "../products/entities/product.entity";
import { CategoryEntity } from "../categories/entities/category.entity";
import { ReturnEntity, ReturnStatus } from "../return/entities/return.entity";

export enum StatisticsPeriod {
  DAILY   = "daily",
  WEEKLY  = "weekly",
  MONTHLY = "monthly",
  YEARLY  = "yearly",
  CUSTOM  = "custom",
}

export interface StatisticsResult {
  period: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;        // grandTotal (qaytarishsiz)
  realRevenue: number;         // ✅ FIX: grandTotal - approved returns
  totalQuantitySold: number;
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  totalDiscount: number;
  grossProfit: number;
  netProfit: number;
  realProfit: number;          // ✅ FIX: netProfit - refundAmount
  totalSales: number;
  averageSaleValue: number;
  totalItems: number;
  avgItemsPerSale: number;
  totalRefunds: number;        // ✅ NEW: tasdiqlangan qaytarishlar summasi
  refundCount: number;         // ✅ NEW: qaytarishlar soni
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  categoryName: string;
  totalQuantitySold: number;
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;        // ✅ NEW: margin %
  averagePrice: number;
  salesCount: number;
}

export interface CategoryPerformance {
  categoryId: string;
  categoryName: string;
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;        // ✅ NEW
  productCount: number;
  totalSales: number;
}

const LOW_STOCK_THRESHOLD = 10; // ✅ FIX: min_stock_limit o'rniga hardcoded threshold

// ✅ FIX: UTC offset — Toshkent UTC+5
const TZ_OFFSET_HOURS = 5;

function toTashkentDay(date: Date): { start: Date; end: Date } {
  const local = new Date(date.getTime() + TZ_OFFSET_HOURS * 3600 * 1000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - TZ_OFFSET_HOURS * 3600 * 1000);
  const end   = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - TZ_OFFSET_HOURS * 3600 * 1000);
  return { start, end };
}

@Injectable()
export class StatisticsService {

  constructor(
    @InjectRepository(SaleEntity)
    private readonly saleRepository: Repository<SaleEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtRepository: Repository<DebtEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(ReturnEntity)
    private readonly returnRepository: Repository<ReturnEntity>,
  ) {}

  // ── Date range helper ──────────────────────────────────────
  private getDateRange(
    period: StatisticsPeriod,
    referenceDate?: Date,
    customStart?: Date,
    customEnd?: Date,
  ): { startDate: Date; endDate: Date; label: string } {
    const now = referenceDate || new Date();

    if (period === StatisticsPeriod.CUSTOM && customStart && customEnd) {
      return {
        startDate: customStart,
        endDate: customEnd,
        label: `${customStart.toLocaleDateString()} - ${customEnd.toLocaleDateString()}`,
      };
    }

    switch (period) {
      case StatisticsPeriod.DAILY: {
        // ✅ FIX: Toshkent timezone bo'yicha kun chegaralari
        const { start, end } = toTashkentDay(now);
        return { startDate: start, endDate: end, label: start.toLocaleDateString("uz-UZ") };
      }
      case StatisticsPeriod.WEEKLY: {
        const { start: todayStart } = toTashkentDay(now);
        const dayOfWeek = (todayStart.getDay() + 6) % 7; // Monday = 0
        const monday = new Date(todayStart.getTime() - dayOfWeek * 86400_000);
        const sunday = new Date(monday.getTime() + 6 * 86400_000 + 23 * 3600_000 + 59 * 60_000 + 59_000 + 999);
        return { startDate: monday, endDate: sunday, label: "Joriy hafta" };
      }
      case StatisticsPeriod.MONTHLY: {
        const { start: todayStart } = toTashkentDay(now);
        const local = new Date(todayStart.getTime() + TZ_OFFSET_HOURS * 3600_000);
        const y = local.getUTCFullYear(), m = local.getUTCMonth();
        const start = new Date(Date.UTC(y, m, 1)   - TZ_OFFSET_HOURS * 3600_000);
        const end   = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999) - TZ_OFFSET_HOURS * 3600_000);
        return { startDate: start, endDate: end, label: "Joriy oy" };
      }
      case StatisticsPeriod.YEARLY: {
        const y = new Date().getFullYear();
        const start = new Date(Date.UTC(y, 0, 1)          - TZ_OFFSET_HOURS * 3600_000);
        const end   = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999) - TZ_OFFSET_HOURS * 3600_000);
        return { startDate: start, endDate: end, label: String(y) };
      }
      default:
        return this.getDateRange(StatisticsPeriod.DAILY, now);
    }
  }

  // ── ✅ FIX: Tasdiqlangan qaytarishlar summasini olish ──────
  private async getApprovedRefunds(startDate: Date, endDate: Date): Promise<{
    totalRefunds: number;
    refundCount: number;
  }> {
    const result = await this.returnRepository
      .createQueryBuilder("ret")
      .innerJoin("ret.originalSale", "sale")
      .select("COALESCE(SUM(ret.refund_amount), 0)", "totalRefunds")
      .addSelect("COUNT(ret.id)", "refundCount")
      .where("ret.status = :status", { status: ReturnStatus.APPROVED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .getRawOne();

    return {
      totalRefunds: parseFloat(result.totalRefunds) || 0,
      refundCount:  parseInt(result.refundCount, 10) || 0,
    };
  }

  // ── Core statistics ────────────────────────────────────────
  async getStatistics(
    period: StatisticsPeriod,
    referenceDate?: string,
    customStart?: string,
    customEnd?: string,
  ): Promise<StatisticsResult> {
    const ref    = referenceDate ? new Date(referenceDate) : undefined;
    const cStart = customStart  ? new Date(customStart)   : undefined;
    const cEnd   = customEnd    ? new Date(customEnd)     : undefined;
    const { startDate, endDate, label } = this.getDateRange(period, ref, cStart, cEnd);

    // Sales aggregate
    const result = await this.saleRepository
      .createQueryBuilder("sale")
      .select("COUNT(sale.id)",                             "totalSales")
      .addSelect('COALESCE(SUM(sale."grandTotal"), 0)',     "totalRevenue")
      .addSelect('COALESCE(SUM(sale."totalDiscount"), 0)',  "totalDiscount")
      .addSelect('COALESCE(SUM(sale."grossProfit"), 0)',    "grossProfit")
      .addSelect('COALESCE(SUM(sale."netProfit"), 0)',      "netProfit")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .getRawOne();

    // Quantity
    const quantityResult = await this.saleRepository
      .createQueryBuilder("sale")
      .leftJoin("sale.items", "item")
      .select("COALESCE(SUM(item.quantity), 0)", "totalQuantity")
      .addSelect("COUNT(DISTINCT item.id)",       "totalItems")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .getRawOne();

    // Payments
    const paymentsResult = await this.paymentRepository
      .createQueryBuilder("payment")
      .leftJoin("payment.sale", "sale")
      .select("payment.method", "method")
      .addSelect("COALESCE(SUM(payment.amount), 0)", "amount")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .groupBy("payment.method")
      .getRawMany();

    let cashAmount = 0, cardAmount = 0, debtAmount = 0;
    for (const p of paymentsResult) {
      const amount = parseFloat(p.amount);
      if (p.method === PaymentMethod.CASH) cashAmount = amount;
      if (p.method === PaymentMethod.CARD) cardAmount = amount;
      if (p.method === PaymentMethod.DEBT) debtAmount = amount;
    }

    // ✅ FIX: qaytarishlarni hisobga olish
    const { totalRefunds, refundCount } = await this.getApprovedRefunds(startDate, endDate);

    const totalSales    = parseInt(result.totalSales, 10);
    const totalRevenue  = parseFloat(result.totalRevenue);
    const netProfit     = parseFloat(result.netProfit);
    const realRevenue   = Math.max(0, totalRevenue - totalRefunds);
    const realProfit    = netProfit - totalRefunds;
    const avgSaleValue  = totalSales > 0 ? totalRevenue / totalSales : 0;
    const totalItems    = parseInt(quantityResult.totalItems, 10);

    return {
      period,
      periodLabel: label,
      startDate: startDate.toISOString(),
      endDate:   endDate.toISOString(),
      totalRevenue:      round(totalRevenue),
      realRevenue:       round(realRevenue),
      totalQuantitySold: round(parseFloat(quantityResult.totalQuantity)),
      cashAmount:        round(cashAmount),
      cardAmount:        round(cardAmount),
      debtAmount:        round(debtAmount),
      totalDiscount:     round(parseFloat(result.totalDiscount)),
      grossProfit:       round(parseFloat(result.grossProfit)),
      netProfit:         round(netProfit),
      realProfit:        round(realProfit),
      totalSales,
      averageSaleValue:  round(avgSaleValue),
      totalItems,
      avgItemsPerSale:   totalSales > 0 ? round(totalItems / totalSales) : 0,
      totalRefunds:      round(totalRefunds),
      refundCount,
    };
  }

  // ── Product performance ────────────────────────────────────
  async getProductPerformance(startDate: Date, endDate: Date, limit = 20): Promise<ProductPerformance[]> {
    const results = await this.saleRepository
      .createQueryBuilder("sale")
      .leftJoin("sale.items", "item")
      .leftJoin("item.product", "product")
      .select("product.id",                          "productId")
      .addSelect("item.product_name_snapshot",        "productName")
      .addSelect("item.category_snapshot",            "categoryName")
      .addSelect("SUM(item.quantity)",                "totalQuantitySold")
      .addSelect("SUM(item.custom_total)",            "totalRevenue")
      // ✅ FIX: purchasePrice 0 bo'lganda foyda noto'g'ri chiqmasin
      .addSelect(
        "SUM(CASE WHEN item.purchase_price_snapshot > 0 THEN (item.custom_unit_price - item.purchase_price_snapshot) * item.quantity ELSE 0 END)",
        "totalProfit",
      )
      .addSelect("AVG(item.custom_unit_price)",        "averagePrice")
      .addSelect("COUNT(DISTINCT sale.id)",            "salesCount")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .groupBy("product.id, item.product_name_snapshot, item.category_snapshot")
      .orderBy("SUM(item.custom_total)", "DESC")
      .limit(limit)
      .getRawMany();

    return results.map(r => {
      const rev    = parseFloat(r.totalRevenue) || 0;
      const profit = parseFloat(r.totalProfit)  || 0;
      return {
        productId:         r.productId || "",
        productName:       r.productName || "Unknown",
        categoryName:      r.categoryName || "Uncategorized",
        totalQuantitySold: parseFloat(r.totalQuantitySold) || 0,
        totalRevenue:      round(rev),
        totalProfit:       round(profit),
        // ✅ FIX: margin %
        profitMargin:      rev > 0 ? round((profit / rev) * 100) : 0,
        averagePrice:      round(parseFloat(r.averagePrice) || 0),
        salesCount:        parseInt(r.salesCount, 10) || 0,
      };
    });
  }

  // ── Category performance ───────────────────────────────────
  async getCategoryPerformance(startDate: Date, endDate: Date): Promise<CategoryPerformance[]> {
    const results = await this.saleRepository
      .createQueryBuilder("sale")
      .leftJoin("sale.items", "item")
      .select("item.category_snapshot",  "categoryName")
      .addSelect("SUM(item.custom_total)", "totalRevenue")
      .addSelect(
        "SUM(CASE WHEN item.purchase_price_snapshot > 0 THEN (item.custom_unit_price - item.purchase_price_snapshot) * item.quantity ELSE 0 END)",
        "totalProfit",
      )
      .addSelect("COUNT(DISTINCT item.product_id)", "productCount")
      .addSelect("COUNT(DISTINCT sale.id)",         "totalSales")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .groupBy("item.category_snapshot")
      .orderBy("SUM(item.custom_total)", "DESC")
      .getRawMany();

    return results.map(r => {
      const rev    = parseFloat(r.totalRevenue) || 0;
      const profit = parseFloat(r.totalProfit)  || 0;
      return {
        categoryId:    "",
        categoryName:  r.categoryName || "Uncategorized",
        totalRevenue:  round(rev),
        totalProfit:   round(profit),
        profitMargin:  rev > 0 ? round((profit / rev) * 100) : 0,
        productCount:  parseInt(r.productCount, 10) || 0,
        totalSales:    parseInt(r.totalSales, 10)   || 0,
      };
    });
  }

  // ── Sales trend (kunlik) ───────────────────────────────────
  async getSalesTrend(days = 30): Promise<Array<{ date: string; sales: number; revenue: number; refunds: number }>> {
    const endDate   = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400_000);

    const salesRows = await this.saleRepository
      .createQueryBuilder("sale")
      .select(`DATE(sale.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')`, "date")
      .addSelect("COUNT(*)",                            "sales")
      .addSelect('COALESCE(SUM(sale."grandTotal"), 0)', "revenue")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .groupBy("1")
      .orderBy("1", "ASC")
      .getRawMany();

    // ✅ FIX: qaytarishlarni ham ko'rsatamiz
    const refundRows = await this.returnRepository
      .createQueryBuilder("ret")
      .innerJoin("ret.originalSale", "sale")
      .select(`DATE(ret.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')`, "date")
      .addSelect("COALESCE(SUM(ret.refund_amount), 0)", "refunds")
      .where("ret.status = :status", { status: ReturnStatus.APPROVED })
      .andWhere("ret.created_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .groupBy("1")
      .getRawMany();

    const refundMap = new Map(refundRows.map(r => [r.date, parseFloat(r.refunds) || 0]));

    return salesRows.map(r => ({
      date:    r.date,
      sales:   parseInt(r.sales, 10) || 0,
      revenue: parseFloat(r.revenue) || 0,
      refunds: refundMap.get(r.date) || 0,
    }));
  }

  // ── ✅ FIX: Daily hourly breakdown (soatlik) ───────────────
  async getHourlyBreakdown(date?: string): Promise<Array<{ hour: number; sales: number; revenue: number }>> {
    const targetDate = date ? new Date(date) : new Date();
    const { start, end } = toTashkentDay(targetDate);

    const rows = await this.saleRepository
      .createQueryBuilder("sale")
      .select(
        `EXTRACT(HOUR FROM (sale.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'))`,
        "hour",
      )
      .addSelect("COUNT(*)",                            "sales")
      .addSelect('COALESCE(SUM(sale."grandTotal"), 0)', "revenue")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start, end })
      .groupBy("1")
      .orderBy("1", "ASC")
      .getRawMany();

    // 0-23 soat to'liq array
    const hourMap = new Map(rows.map(r => [parseInt(r.hour, 10), r]));
    return Array.from({ length: 24 }, (_, h) => {
      const row = hourMap.get(h);
      return {
        hour:    h,
        sales:   row ? parseInt(row.sales, 10) : 0,
        revenue: row ? parseFloat(row.revenue) : 0,
      };
    });
  }

  // ── ✅ FIX: Monthly breakdown — bitta query ────────────────
  async getMonthlyBreakdown(year: number): Promise<Array<{
    month: number; label: string;
    totalRevenue: number; realRevenue: number;
    totalSales: number; netProfit: number;
    totalRefunds: number;
  }>> {
    const start = new Date(Date.UTC(year, 0, 1)           - TZ_OFFSET_HOURS * 3600_000);
    const end   = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - TZ_OFFSET_HOURS * 3600_000);

    // Sales per month — bitta query
    const salesRows = await this.saleRepository
      .createQueryBuilder("sale")
      .select(
        `EXTRACT(MONTH FROM (sale.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'))`,
        "month",
      )
      .addSelect("COUNT(*)",                             "totalSales")
      .addSelect('COALESCE(SUM(sale."grandTotal"), 0)',  "totalRevenue")
      .addSelect('COALESCE(SUM(sale."netProfit"), 0)',   "netProfit")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start, end })
      .groupBy("1")
      .getRawMany();

    // Refunds per month — bitta query
    const refundRows = await this.returnRepository
      .createQueryBuilder("ret")
      .innerJoin("ret.originalSale", "sale")
      .select(
        `EXTRACT(MONTH FROM (sale.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'))`,
        "month",
      )
      .addSelect("COALESCE(SUM(ret.refund_amount), 0)", "totalRefunds")
      .where("ret.status = :status", { status: ReturnStatus.APPROVED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start, end })
      .groupBy("1")
      .getRawMany();

    const salesMap  = new Map(salesRows.map(r  => [parseInt(r.month, 10),  r]));
    const refundMap = new Map(refundRows.map(r => [parseInt(r.month, 10), parseFloat(r.totalRefunds) || 0]));

    const MONTHS = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];

    return Array.from({ length: 12 }, (_, i) => {
      const m     = i + 1;
      const row   = salesMap.get(m);
      const rev   = row ? parseFloat(row.totalRevenue) : 0;
      const refs  = refundMap.get(m) || 0;
      return {
        month:        m,
        label:        MONTHS[i],
        totalRevenue: round(rev),
        realRevenue:  round(Math.max(0, rev - refs)),
        totalSales:   row ? parseInt(row.totalSales, 10) : 0,
        netProfit:    row ? round(parseFloat(row.netProfit)) : 0,
        totalRefunds: round(refs),
      };
    });
  }

  // ── Low stock — ✅ FIX: min_stock_limit yo'q, hardcoded ───
  async getLowStockProducts(limit = 10) {
    return this.productRepository
      .createQueryBuilder("product")
      .where("product.stock_quantity <= :threshold", { threshold: LOW_STOCK_THRESHOLD })
      .andWhere("product.deleted_at IS NULL")
      .orderBy("product.stock_quantity", "ASC")
      .limit(limit)
      .getMany();
  }

  // ── Best selling ───────────────────────────────────────────
  async getBestSellingProducts(startDate: Date, endDate: Date, limit = 10) {
    const results = await this.saleRepository
      .createQueryBuilder("sale")
      .leftJoin("sale.items", "item")
      .leftJoin("item.product", "product")
      .select("item.product_id",             "productId")
      .addSelect("item.product_name_snapshot","productName")
      .addSelect("product.unit",              "unit")
      .addSelect("SUM(item.quantity)",        "totalQuantitySold")
      .addSelect("SUM(item.custom_total)",    "totalRevenue")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .groupBy("item.product_id, item.product_name_snapshot, product.unit")
      .orderBy("SUM(item.quantity)", "DESC")
      .limit(limit)
      .getRawMany();

    return results.map(r => ({
      productId:         r.productId,
      productName:       r.productName || "Unknown",
      unit:              r.unit || "piece",
      totalQuantitySold: parseFloat(r.totalQuantitySold) || 0,
      totalRevenue:      parseFloat(r.totalRevenue)      || 0,
    }));
  }

  // ── Recent sales ───────────────────────────────────────────
  async getRecentSales(date: Date, limit = 20) {
    // ✅ FIX: Toshkent timezone bo'yicha kun
    const { start, end } = toTashkentDay(date);

    const sales = await this.saleRepository.find({
      where: { status: SaleStatus.COMPLETED },
      relations: ["customer", "debt"],
      order: { completedAt: "DESC" },
      take: limit,
    });

    // completedAt bo'yicha filter (TypeORM Between ishlatmaymiz — timezone muammosi bor)
    const filtered = sales.filter(s => {
      const t = s.completedAt ? new Date(s.completedAt).getTime() : 0;
      return t >= start.getTime() && t <= end.getTime();
    });

    return Promise.all(
      filtered.map(async (sale) => {
        const payments = await this.paymentRepository.find({ where: { saleId: sale.id } });
        let paymentMethod = "CASH";
        if (payments.length > 1) paymentMethod = "MIXED";
        else if (payments.length === 1) paymentMethod = payments[0].method;

        const customerName =
          (sale as any).customer?.name ||
          (sale as any).debt?.debtorName ||
          null;

        return { ...sale, customerName, paymentMethod };
      }),
    );
  }

  // ── Summary by range ───────────────────────────────────────
  async getSummaryByRange(range: "daily" | "weekly" | "monthly" | "yearly") {
    const periodMap = {
      daily:   StatisticsPeriod.DAILY,
      weekly:  StatisticsPeriod.WEEKLY,
      monthly: StatisticsPeriod.MONTHLY,
      yearly:  StatisticsPeriod.YEARLY,
    };

    const period = periodMap[range];
    const stats  = await this.getStatistics(period);

    let chartData: { label: string; value: number; refunds?: number }[] = [];

    if (range === "daily") {
      // ✅ FIX: soatlik breakdown
      const hourly = await this.getHourlyBreakdown();
      chartData = hourly.map(h => ({
        label: `${h.hour}:00`,
        value: h.revenue,
      })).filter((_, i) => i % 2 === 0 || hourly[i].revenue > 0); // bo'sh soatlarni qisqartirish
    } else if (range === "weekly") {
      const trend = await this.getSalesTrend(7);
      const DAYS = ["Yak","Du","Se","Ch","Pa","Ju","Sha"];
      chartData = trend.map(t => ({
        label:   DAYS[new Date(t.date).getDay()],
        value:   t.revenue,
        refunds: t.refunds,
      }));
    } else if (range === "monthly") {
      const trend = await this.getSalesTrend(30);
      chartData = trend.map(t => ({
        label:   new Date(t.date).getDate().toString(),
        value:   t.revenue,
        refunds: t.refunds,
      }));
    } else if (range === "yearly") {
      const breakdown = await this.getMonthlyBreakdown(new Date().getFullYear());
      chartData = breakdown.map(m => ({
        label:   m.label,
        value:   m.totalRevenue,
        refunds: m.totalRefunds,
      }));
    }

    return {
      revenue:      stats.totalRevenue,
      realRevenue:  stats.realRevenue,
      profit:       stats.netProfit,
      realProfit:   stats.realProfit,
      ordersCount:  stats.totalSales,
      avgOrder:     stats.averageSaleValue,
      totalRefunds: stats.totalRefunds,
      refundCount:  stats.refundCount,
      chartData,
      paymentSplit: {
        cash: stats.cashAmount,
        card: stats.cardAmount,
        debt: stats.debtAmount,
      },
    };
  }

  // ── Dashboard by date ──────────────────────────────────────
  async getDashboardByDate(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const { start, end } = toTashkentDay(targetDate);

    const [todayStats, recentSales, lowStock, bestSelling] = await Promise.all([
      this.getStatistics(StatisticsPeriod.DAILY, targetDate.toISOString()),
      this.getRecentSales(targetDate, 20),
      this.getLowStockProducts(10),
      this.getBestSellingProducts(start, end, 10),
    ]);

    return {
      todayRevenue:  todayStats.realRevenue,   // ✅ qaytarishsiz haqiqiy tushum
      grossProfit:   todayStats.grossProfit,
      netProfit:     todayStats.realProfit,    // ✅ qaytarishlar ayirilgan
      cashTotal:     todayStats.cashAmount,
      cardTotal:     todayStats.cardAmount,
      debtTotal:     todayStats.debtAmount,
      totalRefunds:  todayStats.totalRefunds,
      refundCount:   todayStats.refundCount,
      recentSales: recentSales.map(sale => ({
        id:            sale.id,
        createdAt:     sale.completedAt || sale.createdAt,
        customerName:  sale.customerName || null,
        paymentMethod: sale.paymentMethod,
        total:         Number(sale.grandTotal) || 0,
      })),
      lowStockProducts: lowStock.map(p => ({
        id:       p.id,
        name:     p.name,
        stockQty: Number(p.stockQuantity) || 0,
      })),
      bestSellingProducts: bestSelling.map(p => ({
        id:    p.productId,
        name:  p.productName,
        qty:   p.totalQuantitySold,
        total: p.totalRevenue,
      })),
    };
  }

  // ── Dashboard summary (eski endpoint uchun) ────────────────
  async getDashboardSummary() {
    const [today, thisWeek, thisMonth] = await Promise.all([
      this.getStatistics(StatisticsPeriod.DAILY),
      this.getStatistics(StatisticsPeriod.WEEKLY),
      this.getStatistics(StatisticsPeriod.MONTHLY),
    ]);

    const [totalProducts, totalCategories, lowStockCount, pendingDebtsCount, pendingReturnsCount] =
      await Promise.all([
        this.productRepository.count(),
        this.categoryRepository.count(),
        this.productRepository
          .createQueryBuilder("product")
          .where("product.stock_quantity <= :threshold", { threshold: LOW_STOCK_THRESHOLD })
          .andWhere("product.deleted_at IS NULL")
          .getCount(),
        this.debtRepository.count({ where: { status: DebtStatus.PENDING } }),
        this.returnRepository.count({ where: { status: ReturnStatus.PENDING } }),
      ]);

    const debtSum = await this.debtRepository
      .createQueryBuilder("debt")
      .select("COALESCE(SUM(debt.remaining_amount), 0)", "total")
      .where("debt.status IN (:...statuses)", {
        statuses: [DebtStatus.PENDING, DebtStatus.PARTIALLY_PAID],
      })
      .getRawOne();

    const recentSales = await this.saleRepository.find({
      relations: ["createdBy"],
      order: { createdAt: "DESC" },
      take: 10,
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
    const topProducts = await this.getBestSellingProducts(thirtyDaysAgo, new Date(), 5);

    const salesByStatus = await this.saleRepository
      .createQueryBuilder("sale")
      .select("sale.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("sale.status")
      .getRawMany();

    const statusMap: Record<string, number> = {};
    for (const row of salesByStatus) {
      statusMap[row.status] = parseInt(row.count, 10);
    }

    return {
      today,
      thisWeek,
      thisMonth,
      totalProducts,
      totalCategories,
      lowStockProducts:  lowStockCount,
      pendingDebts:      pendingDebtsCount,
      pendingReturns:    pendingReturnsCount,
      totalDebtAmount:   parseFloat(debtSum.total),
      recentSales: recentSales.map(s => ({
        id:                s.id,
        saleNumber:        s.saleNumber,
        status:            s.status,
        grandTotal:        Number(s.grandTotal),
        createdAt:         s.createdAt,
        createdByUsername: s.createdBy?.fullName || s.createdBy?.phone || "N/A",
      })),
      topProducts: topProducts.map(p => ({
        productId:    p.productId,
        productName:  p.productName,
        quantitySold: p.totalQuantitySold,
        revenue:      p.totalRevenue,
      })),
      salesByStatus: statusMap,
    };
  }
}

// ── Util ───────────────────────────────────────────────────────
function round(n: number): number {
  return Math.round(n * 100) / 100;
}