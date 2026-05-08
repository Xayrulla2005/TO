// ============================================================
// src/statistics/statistics.service.ts
// ============================================================
import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { SaleEntity, SaleStatus } from "../sale/entities/sale.entity";
import { PaymentEntity, PaymentMethod } from "../payments/entities/payment.entity";
import { DebtEntity, DebtStatus } from "../debts/entities/debt.entity";
import { ProductEntity } from "../products/entities/product.entity";
import { CategoryEntity } from "../categories/entities/category.entity";
import { ReturnEntity } from "../return/entities/return.entity";

// ─────────────────────────────────────────────────────────────
// ENUMS & INTERFACES
// ─────────────────────────────────────────────────────────────
export enum StatisticsPeriod {
  DAILY   = "daily",
  WEEKLY  = "weekly",
  MONTHLY = "monthly",
  YEARLY  = "yearly",
  CUSTOM  = "custom",
}

export interface DateRange {
  startDate: Date;
  endDate:   Date;
  label:     string;
}

export interface StatisticsResult {
  period:            string;
  periodLabel:       string;
  startDate:         string;
  endDate:           string;
  totalRevenue:      number;
  totalQuantitySold: number;
  cashAmount:        number;
  cardAmount:        number;
  debtAmount:        number;
  totalDiscount:     number;
  grossProfit:       number;
  netProfit:         number;
  totalSales:        number;
  averageSaleValue:  number;
  totalItems:        number;
  avgItemsPerSale:   number;
}

export interface ProductPerformance {
  productId:         string;
  productName:       string;
  categoryName:      string;
  totalQuantitySold: number;
  totalRevenue:      number;
  totalProfit:       number;
  profitMargin:      number;
  averagePrice:      number;
  salesCount:        number;
}

export interface CategoryPerformance {
  categoryId:    string;
  categoryName:  string;
  totalRevenue:  number;
  totalProfit:   number;
  profitMargin:  number;
  productCount:  number;
  totalSales:    number;
}

export interface MonthlyBreakdownItem {
  month:         number;
  label:         string;
  totalRevenue:  number;
  realRevenue:   number;
  grossProfit:   number;
  netProfit:     number;
  totalDiscount: number;
  totalSales:    number;
  totalRefunds:  number;
  refundCount:   number;
}

export interface SummaryResult {
  revenue:      number;
  realRevenue:  number;
  profit:       number;
  realProfit:   number;
  grossProfit:  number;
  ordersCount:  number;
  avgOrder:     number;
  margin:       number;
  totalRefunds: number;
  refundCount:  number;
  chartData:    ChartPoint[];
  paymentSplit: { cash: number; card: number; debt: number };
}

export interface ChartPoint {
  label:    string;
  value:    number;
  refunds?: number;
}

export interface DashboardSummary {
  today:              StatisticsResult;
  thisWeek:           StatisticsResult;
  thisMonth:          StatisticsResult;
  totalProducts:      number;
  totalCategories:    number;
  lowStockProducts:   number;
  pendingDebts:       number;
  pendingReturns:     number;
  totalDebtAmount:    number;
  recentSales:        RecentSale[];
  topProducts:        TopProduct[];
  salesByStatus:      Record<string, number>;
}

export interface RecentSale {
  id:                  string;
  saleNumber:          string;
  status:              string;
  grandTotal:          number;
  createdAt:           Date;
  createdByUsername:   string;
}

export interface TopProduct {
  productId:   string;
  productName: string;
  quantitySold: number;
  revenue:     number;
}

// Raw query type-lar (PostgreSQL hamma sonlarni string qaytaradi)
interface RawStatisticsResult {
  totalSales:    string;
  totalRevenue:  string;
  totalDiscount: string;
  grossProfit:   string;
  netProfit:     string;
}

interface RawQuantityResult {
  totalQuantity: string;
  totalItems:    string;
}

interface RawPaymentResult {
  method: string;
  amount: string;
}

interface RawProductResult {
  productId:         string | null;
  productName:       string | null;
  categoryName:      string | null;
  totalQuantitySold: string;
  totalRevenue:      string;
  totalProfit:       string;
  averagePrice:      string;
  salesCount:        string;
}

interface RawCategoryResult {
  categoryName:  string | null;
  totalRevenue:  string;
  totalProfit:   string;
  productCount:  string;
  totalSales:    string;
}

interface RawMonthlyResult {
  month:         string;
  totalRevenue:  string;
  grossProfit:   string;
  netProfit:     string;
  totalDiscount: string;
  totalSales:    string;
}

interface RawRefundResult {
  month:        string;
  totalRefunds: string;
  refundCount:  string;
}

interface RawTrendResult {
  date:    string;
  sales:   string;
  revenue: string;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const LOW_STOCK_THRESHOLD = 5;

const MONTH_LABELS = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyn",
  "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek",
];

const r2 = (v: number) => Math.round(v * 100) / 100;
const toFloat  = (v: string | null | undefined) => parseFloat(v  || "0") || 0;
const toInt    = (v: string | null | undefined) => parseInt(v    || "0", 10) || 0;

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────
@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

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

  // ─── Date Range Helpers ───────────────────────────────────
  getDateRange(
    period: StatisticsPeriod,
    referenceDate?: Date,
    customStart?: Date,
    customEnd?: Date,
  ): DateRange {
    const now = referenceDate ?? new Date();

    if (period === StatisticsPeriod.CUSTOM && customStart && customEnd) {
      return {
        startDate: customStart,
        endDate:   customEnd,
        label:     `${customStart.toLocaleDateString()} - ${customEnd.toLocaleDateString()}`,
      };
    }

    switch (period) {
      case StatisticsPeriod.DAILY: {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return {
          startDate: start,
          endDate:   end,
          label:     start.toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" }),
        };
      }
      case StatisticsPeriod.WEEKLY: {
        const dayOfWeek = now.getDay();
        const monday    = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return {
          startDate: monday,
          endDate:   sunday,
          label:     `${monday.toLocaleDateString("uz-UZ", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("uz-UZ", { month: "short", day: "numeric", year: "numeric" })}`,
        };
      }
      case StatisticsPeriod.MONTHLY: {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return {
          startDate: start,
          endDate:   end,
          label:     start.toLocaleDateString("uz-UZ", { year: "numeric", month: "long" }),
        };
      }
      case StatisticsPeriod.YEARLY: {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        const end   = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { startDate: start, endDate: end, label: String(now.getFullYear()) };
      }
      default:
        return this.getDateRange(StatisticsPeriod.DAILY, now);
    }
  }

  // ─── Core Statistics Query ────────────────────────────────
  async getStatistics(
    period: StatisticsPeriod,
    referenceDate?: string,
    customStart?: string,
    customEnd?: string,
  ): Promise<StatisticsResult> {
    try {
      const ref    = referenceDate ? new Date(referenceDate) : undefined;
      const cStart = customStart   ? new Date(customStart)   : undefined;
      const cEnd   = customEnd     ? new Date(customEnd)     : undefined;
      const { startDate, endDate, label } = this.getDateRange(period, ref, cStart, cEnd);

      // ── Parallel queries ──────────────────────────────────
      const [result, quantityResult, paymentsResult] = await Promise.all([
        this.saleRepository
          .createQueryBuilder("sale")
          .select("COUNT(sale.id)", "totalSales")
          .addSelect('COALESCE(SUM(sale."grandTotal"), 0)',    "totalRevenue")
          .addSelect('COALESCE(SUM(sale."totalDiscount"), 0)', "totalDiscount")
          .addSelect('COALESCE(SUM(sale."grossProfit"), 0)',   "grossProfit")
          .addSelect('COALESCE(SUM(sale."netProfit"), 0)',     "netProfit")
          .where("sale.status = :status", { status: SaleStatus.COMPLETED })
          .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
          .getRawOne<RawStatisticsResult>(),

        this.saleRepository
          .createQueryBuilder("sale")
          .leftJoin("sale.items", "item")
          .select("COALESCE(SUM(item.quantity), 0)", "totalQuantity")
          .addSelect("COUNT(DISTINCT item.id)",      "totalItems")
          .where("sale.status = :status", { status: SaleStatus.COMPLETED })
          .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
          .getRawOne<RawQuantityResult>(),

        this.paymentRepository
          .createQueryBuilder("payment")
          .leftJoin("payment.sale", "sale")
          .select("payment.method",                          "method")
          .addSelect("COALESCE(SUM(payment.amount), 0)",     "amount")
          .where("sale.status = :status", { status: SaleStatus.COMPLETED })
          .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
          .groupBy("payment.method")
          .getRawMany<RawPaymentResult>(),
      ]);

      let cashAmount = 0;
      let cardAmount = 0;
      let debtAmount = 0;
      for (const payment of paymentsResult) {
        const amount = toFloat(payment.amount);
        if (payment.method === PaymentMethod.CASH) cashAmount = amount;
        if (payment.method === PaymentMethod.CARD) cardAmount = amount;
        if (payment.method === PaymentMethod.DEBT) debtAmount = amount;
      }

      const totalSales   = toInt(result?.totalSales);
      const totalRevenue = toFloat(result?.totalRevenue);
      const totalItems   = toInt(quantityResult?.totalItems);

      return {
        period,
        periodLabel:       label,
        startDate:         startDate.toISOString(),
        endDate:           endDate.toISOString(),
        totalRevenue:      r2(totalRevenue),
        totalQuantitySold: r2(toFloat(quantityResult?.totalQuantity)),
        cashAmount:        r2(cashAmount),
        cardAmount:        r2(cardAmount),
        debtAmount:        r2(debtAmount),
        totalDiscount:     r2(toFloat(result?.totalDiscount)),
        grossProfit:       r2(toFloat(result?.grossProfit)),
        netProfit:         r2(toFloat(result?.netProfit)),
        totalSales,
        averageSaleValue:  r2(totalSales > 0 ? totalRevenue / totalSales : 0),
        totalItems,
        avgItemsPerSale:   r2(totalSales > 0 ? totalItems / totalSales : 0),
      };
    } catch (error) {
      this.logger.error("getStatistics failed", error);
      throw new InternalServerErrorException("Statistikani olishda xatolik yuz berdi");
    }
  }

  // ─── Sales Trend ──────────────────────────────────────────
  async getSalesTrend(days = 30): Promise<{ date: string; sales: number; revenue: number }[]> {
    try {
      const endDate   = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const results = await this.saleRepository
        .createQueryBuilder("sale")
        .select('DATE("sale"."completed_at")',               "date")
        .addSelect("COUNT(*)",                               "sales")
        .addSelect('COALESCE(SUM("sale"."grandTotal"), 0)', "revenue")
        .where("sale.status = :status", { status: SaleStatus.COMPLETED })
        .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
        .groupBy('DATE("sale"."completed_at")')
        .orderBy("date", "ASC")
        .getRawMany<RawTrendResult>();

      return results.map((r) => ({
        date:    r.date,
        sales:   toInt(r.sales),
        revenue: toFloat(r.revenue),
      }));
    } catch (error) {
      this.logger.error("getSalesTrend failed", error);
      throw new InternalServerErrorException("Trend ma'lumotlarini olishda xatolik");
    }
  }

  // ─── Chart Data Builder ───────────────────────────────────
  private async buildChartData(range: string): Promise<ChartPoint[]> {
    if (range === "daily") {
      const trend = await this.getSalesTrend(1);
      return trend.map((t) => ({
        label: `${new Date(t.date).getHours()}:00`,
        value: t.revenue,
      }));
    }
    if (range === "weekly") {
      const trend = await this.getSalesTrend(7);
      return trend.map((t) => ({
        label: new Date(t.date).toLocaleDateString("uz-UZ", { weekday: "short" }),
        value: t.revenue,
      }));
    }
    if (range === "monthly") {
      const trend = await this.getSalesTrend(30);
      return trend.map((t) => ({
        label: String(new Date(t.date).getDate()),
        value: t.revenue,
      }));
    }
    if (range === "yearly") {
      const breakdown = await this.getMonthlyBreakdown(new Date().getFullYear());
      return breakdown.map((m) => ({
        label:   m.label,
        value:   m.totalRevenue,
        refunds: m.totalRefunds,
      }));
    }
    return [];
  }

  // ─── Statistics Summary ───────────────────────────────────
  async getSummaryByRange(
    range: "daily" | "weekly" | "monthly" | "yearly",
  ): Promise<SummaryResult> {
    try {
      const periodMap: Record<string, StatisticsPeriod> = {
        daily:   StatisticsPeriod.DAILY,
        weekly:  StatisticsPeriod.WEEKLY,
        monthly: StatisticsPeriod.MONTHLY,
        yearly:  StatisticsPeriod.YEARLY,
      };

      const period = periodMap[range] ?? StatisticsPeriod.DAILY;
      const { startDate, endDate } = this.getDateRange(period);

      // ── Hammasi parallel ─────────────────────────────────
      const [stats, chartData, refundResult] = await Promise.all([
        this.getStatistics(period),
        this.buildChartData(range),
        this.returnRepository
          .createQueryBuilder("ret")
          .select("COALESCE(SUM(ret.refund_amount), 0)", "total")
          .addSelect("COUNT(ret.id)",                    "count")
          .where("ret.status = :status", { status: "APPROVED" })
          .andWhere("ret.created_at BETWEEN :start AND :end", { start: startDate, end: endDate })
          .getRawOne<{ total: string; count: string }>(),
      ]);

      const totalRefunds = toFloat(refundResult?.total);
      const refundCount  = toInt(refundResult?.count);
      const revenue      = stats.totalRevenue;
      const realRevenue  = Math.max(0, revenue - totalRefunds);
      const netProfit    = stats.netProfit;
      const grossProfit  = stats.grossProfit;
      const realProfit   = Math.max(0, netProfit - totalRefunds);
      const margin       = realRevenue > 0 ? Math.round((realProfit / realRevenue) * 100) : 0;

      return {
        revenue,
        realRevenue,
        profit:      netProfit,
        realProfit,
        grossProfit,
        ordersCount: stats.totalSales,
        avgOrder:    stats.averageSaleValue,
        margin,
        totalRefunds,
        refundCount,
        chartData,
        paymentSplit: {
          cash: stats.cashAmount,
          card: stats.cardAmount,
          debt: stats.debtAmount,
        },
      };
    } catch (error) {
      this.logger.error(`getSummaryByRange failed for range: ${range}`, error);
      throw new InternalServerErrorException("Umumiy statistikani olishda xatolik");
    }
  }

  // ─── Monthly Breakdown ────────────────────────────────────
  async getMonthlyBreakdown(year: number): Promise<MonthlyBreakdownItem[]> {
    try {
      // Parallel: savdolar + qaytarishlar
      const [rows, refundRows] = await Promise.all([
        this.saleRepository
          .createQueryBuilder("sale")
          .select("EXTRACT(MONTH FROM sale.completed_at)::int",    "month")
          .addSelect('COALESCE(SUM(sale."grandTotal"), 0)',         "totalRevenue")
          .addSelect('COALESCE(SUM(sale."grossProfit"), 0)',        "grossProfit")
          .addSelect('COALESCE(SUM(sale."netProfit"), 0)',          "netProfit")
          .addSelect('COALESCE(SUM(sale."totalDiscount"), 0)',      "totalDiscount")
          .addSelect("COUNT(sale.id)",                              "totalSales")
          .where("sale.status = :status", { status: SaleStatus.COMPLETED })
          .andWhere("EXTRACT(YEAR FROM sale.completed_at) = :year", { year })
          .groupBy("EXTRACT(MONTH FROM sale.completed_at)::int")
          .orderBy("EXTRACT(MONTH FROM sale.completed_at)::int", "ASC")
          .getRawMany<RawMonthlyResult>(),

        this.returnRepository
          .createQueryBuilder("ret")
          .select("EXTRACT(MONTH FROM ret.created_at)::int",    "month")
          .addSelect("COALESCE(SUM(ret.refund_amount), 0)",      "totalRefunds")
          .addSelect("COUNT(ret.id)",                            "refundCount")
          .where("ret.status = :status", { status: "APPROVED" })
          .andWhere("EXTRACT(YEAR FROM ret.created_at) = :year", { year })
          .groupBy("EXTRACT(MONTH FROM ret.created_at)::int")
          .getRawMany<RawRefundResult>(),
      ]);

      const refundMap = new Map(refundRows.map((r) => [toInt(r.month), r]));

      return Array.from({ length: 12 }, (_, i) => {
        const monthNum     = i + 1;
        const row          = rows.find((r) => toInt(r.month) === monthNum);
        const refund       = refundMap.get(monthNum);
        const totalRevenue = toFloat(row?.totalRevenue);
        const netProfit    = toFloat(row?.netProfit);
        const totalRefunds = toFloat(refund?.totalRefunds);
        const realRevenue  = Math.max(0, totalRevenue - totalRefunds);

        return {
          month:         monthNum,
          label:         MONTH_LABELS[i],
          totalRevenue,
          realRevenue,
          grossProfit:   toFloat(row?.grossProfit),
          netProfit,
          totalDiscount: toFloat(row?.totalDiscount),
          totalSales:    toInt(row?.totalSales),
          totalRefunds,
          refundCount:   toInt(refund?.refundCount),
        };
      });
    } catch (error) {
      this.logger.error(`getMonthlyBreakdown failed for year: ${year}`, error);
      throw new InternalServerErrorException("Oylik ma'lumotlarni olishda xatolik");
    }
  }

  // ─── Product Performance ──────────────────────────────────
  async getProductPerformance(
    startDate: Date,
    endDate:   Date,
    limit = 20,
  ): Promise<ProductPerformance[]> {
    try {
      const results = await this.saleRepository
        .createQueryBuilder("sale")
        .leftJoin("sale.items", "item")
        .leftJoin("item.product", "product")
        .select("product.id",                                                                      "productId")
        .addSelect("item.product_name_snapshot",                                                   "productName")
        .addSelect("item.category_snapshot",                                                       "categoryName")
        .addSelect("SUM(item.quantity)",                                                           "totalQuantitySold")
        .addSelect("SUM(item.custom_total)",                                                       "totalRevenue")
        .addSelect("SUM((item.custom_unit_price - item.purchase_price_snapshot) * item.quantity)", "totalProfit")
        .addSelect("AVG(item.custom_unit_price)",                                                  "averagePrice")
        .addSelect("COUNT(DISTINCT sale.id)",                                                      "salesCount")
        .where("sale.status = :status", { status: SaleStatus.COMPLETED })
        .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
        .groupBy("product.id, item.product_name_snapshot, item.category_snapshot")
        .orderBy("SUM(item.custom_total)", "DESC")
        .limit(limit)
        .getRawMany<RawProductResult>();

      return results.map((r) => {
        const totalRevenue = toFloat(r.totalRevenue);
        const totalProfit  = toFloat(r.totalProfit);
        const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

        return {
          productId:         r.productId         ?? "",
          productName:       r.productName        ?? "Noma'lum",
          categoryName:      r.categoryName       ?? "Kategoriyasiz",
          totalQuantitySold: toFloat(r.totalQuantitySold),
          totalRevenue,
          totalProfit,
          profitMargin,
          averagePrice:      toFloat(r.averagePrice),
          salesCount:        toInt(r.salesCount),
        };
      });
    } catch (error) {
      this.logger.error("getProductPerformance failed", error);
      throw new InternalServerErrorException("Mahsulot statistikasini olishda xatolik");
    }
  }

  // ─── Category Performance ─────────────────────────────────
  async getCategoryPerformance(
    startDate: Date,
    endDate:   Date,
  ): Promise<CategoryPerformance[]> {
    try {
      const results = await this.saleRepository
        .createQueryBuilder("sale")
        .leftJoin("sale.items", "item")
        .select("item.category_snapshot",                                                          "categoryName")
        .addSelect("SUM(item.custom_total)",                                                       "totalRevenue")
        .addSelect("SUM((item.custom_unit_price - item.purchase_price_snapshot) * item.quantity)", "totalProfit")
        .addSelect("COUNT(DISTINCT item.product_id)",                                              "productCount")
        .addSelect("COUNT(DISTINCT sale.id)",                                                      "totalSales")
        .where("sale.status = :status", { status: SaleStatus.COMPLETED })
        .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
        .groupBy("item.category_snapshot")
        .orderBy("SUM(item.custom_total)", "DESC")
        .getRawMany<RawCategoryResult>();

      return results.map((r) => {
        const totalRevenue = toFloat(r.totalRevenue);
        const totalProfit  = toFloat(r.totalProfit);
        const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

        return {
          categoryId:   "",
          categoryName: r.categoryName  ?? "Kategoriyasiz",
          totalRevenue,
          totalProfit,
          profitMargin,
          productCount: toInt(r.productCount),
          totalSales:   toInt(r.totalSales),
        };
      });
    } catch (error) {
      this.logger.error("getCategoryPerformance failed", error);
      throw new InternalServerErrorException("Kategoriya statistikasini olishda xatolik");
    }
  }

  // ─── Dashboard Summary ────────────────────────────────────
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const [today, thisWeek, thisMonth] = await Promise.all([
        this.getStatistics(StatisticsPeriod.DAILY),
        this.getStatistics(StatisticsPeriod.WEEKLY),
        this.getStatistics(StatisticsPeriod.MONTHLY),
      ]);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalProducts,
        totalCategories,
        lowStockCount,
        pendingDebtsCount,
        pendingReturnsCount,
        debtSum,
        recentSales,
        topProducts,
        salesByStatusRaw,
      ] = await Promise.all([
        this.productRepository.count(),
        this.categoryRepository.count(),
        this.productRepository
          .createQueryBuilder("product")
          .where("product.stock_quantity <= :threshold", { threshold: LOW_STOCK_THRESHOLD })
          .andWhere("product.deleted_at IS NULL")
          .getCount(),
        this.debtRepository.count({ where: { status: DebtStatus.PENDING } }),
        this.returnRepository.count({ where: { status: "PENDING" as any } }),
        this.debtRepository
          .createQueryBuilder("debt")
          .select("COALESCE(SUM(debt.remaining_amount), 0)", "total")
          .where("debt.status IN (:...statuses)", {
            statuses: [DebtStatus.PENDING, DebtStatus.PARTIALLY_PAID],
          })
          .getRawOne<{ total: string }>(),
        this.saleRepository.find({
          relations: ["createdBy"],
          order:     { createdAt: "DESC" },
          take:      10,
        }),
        this.saleRepository
          .createQueryBuilder("sale")
          .leftJoin("sale.items", "item")
          .leftJoin("item.product", "product")
          .select("product.id",                   "productId")
          .addSelect("item.product_name_snapshot", "productName")
          .addSelect("SUM(item.quantity)",          "quantitySold")
          .addSelect("SUM(item.custom_total)",      "revenue")
          .where("sale.status = :status", { status: SaleStatus.COMPLETED })
          .andWhere("sale.completed_at >= :date",  { date: thirtyDaysAgo })
          .groupBy("product.id, item.product_name_snapshot")
          .orderBy("SUM(item.quantity)", "DESC")
          .limit(5)
          .getRawMany(),
        this.saleRepository
          .createQueryBuilder("sale")
          .select("sale.status", "status")
          .addSelect("COUNT(*)",  "count")
          .groupBy("sale.status")
          .getRawMany(),
      ]);

      const statusMap: Record<string, number> = {};
      for (const row of salesByStatusRaw) {
        statusMap[row.status] = toInt(row.count);
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
        totalDebtAmount:   toFloat(debtSum?.total),
        recentSales: recentSales.map((s) => ({
          id:                s.id,
          saleNumber:        s.saleNumber,
          status:            s.status,
          grandTotal:        Number(s.grandTotal) || 0,
          createdAt:         s.createdAt,
          createdByUsername: (s as any).createdBy?.fullName || (s as any).createdBy?.phone || "N/A",
        })),
        topProducts: topProducts.map((p) => ({
          productId:    p.productId   || "",
          productName:  p.productName || "Noma'lum",
          quantitySold: toFloat(p.quantitySold),
          revenue:      toFloat(p.revenue),
        })),
        salesByStatus: statusMap,
      };
    } catch (error) {
      this.logger.error("getDashboardSummary failed", error);
      throw new InternalServerErrorException("Dashboard ma'lumotlarini olishda xatolik");
    }
  }

  // ─── Dashboard By Date ────────────────────────────────────
  async getDashboardByDate(date?: string) {
    try {
      const targetDate  = date ? new Date(date) : new Date();
      const startOfDay  = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay    = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const [todayStats, recentSales, lowStock, bestSelling] = await Promise.all([
        this.getStatistics(StatisticsPeriod.DAILY, targetDate.toISOString()),
        this.getRecentSales(targetDate, 20),
        this.getLowStockProducts(10),
        this.getBestSellingProducts(startOfDay, endOfDay, 10),
      ]);

      return {
        todayRevenue: todayStats.totalRevenue,
        grossProfit:  todayStats.grossProfit,
        cashTotal:    todayStats.cashAmount,
        debtTotal:    todayStats.debtAmount,
        recentSales:  recentSales.map((sale) => ({
          id:            sale.id,
          createdAt:     sale.createdAt,
          customerName:  (sale as any).customerName ?? null,
          paymentMethod: (sale as any).paymentMethod,
          total:         Number((sale as any).grandTotal) || 0,
        })),
        lowStockProducts: lowStock.map((p) => ({
          id:       p.id,
          name:     p.name,
          stockQty: Number((p as any).stockQuantity) || 0,
        })),
        bestSellingProducts: bestSelling.map((p) => ({
          id:    p.productId,
          name:  p.productName,
          qty:   p.totalQuantitySold,
          total: p.totalRevenue,
        })),
      };
    } catch (error) {
      this.logger.error("getDashboardByDate failed", error);
      throw new InternalServerErrorException("Dashboard ma'lumotlarini olishda xatolik");
    }
  }

  // ─── Helper: Recent Sales ─────────────────────────────────
  async getRecentSales(date: Date, limit = 20) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await this.saleRepository.find({
      where: {
        status:      SaleStatus.COMPLETED,
        completedAt: Between(startOfDay, endOfDay),
      },
      order: { completedAt: "DESC" },
      take:  limit,
    });

    return Promise.all(
      sales.map(async (sale) => {
        const payments = await this.paymentRepository.find({
          where: { saleId: sale.id },
        });
        let paymentMethod = "CASH";
        if (payments.length > 1)     paymentMethod = "MIXED";
        else if (payments.length === 1) paymentMethod = payments[0].method;
        return { ...sale, customerName: null, paymentMethod };
      }),
    );
  }

  // ─── Helper: Low Stock ────────────────────────────────────
  async getLowStockProducts(limit = 10) {
    return this.productRepository
      .createQueryBuilder("product")
      .where("product.stock_quantity <= :threshold", { threshold: LOW_STOCK_THRESHOLD })
      .andWhere("product.deleted_at IS NULL")
      .orderBy("product.stock_quantity", "ASC")
      .limit(limit)
      .getMany();
  }

  // ─── Helper: Best Selling ─────────────────────────────────
  async getBestSellingProducts(
    startDate: Date,
    endDate:   Date,
    limit = 10,
  ): Promise<{ productId: string; productName: string; totalQuantitySold: number; totalRevenue: number }[]> {
    const results = await this.saleRepository
      .createQueryBuilder("sale")
      .leftJoin("sale.items", "item")
      .select("item.product_id",           "productId")
      .addSelect("item.product_name_snapshot", "productName")
      .addSelect("SUM(item.quantity)",      "totalQuantitySold")
      .addSelect("SUM(item.custom_total)",  "totalRevenue")
      .where("sale.status = :status", { status: SaleStatus.COMPLETED })
      .andWhere("sale.completed_at BETWEEN :start AND :end", { start: startDate, end: endDate })
      .groupBy("item.product_id, item.product_name_snapshot")
      .orderBy("SUM(item.quantity)", "DESC")
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      productId:         r.productId    || "",
      productName:       r.productName  || "Noma'lum",
      totalQuantitySold: toFloat(r.totalQuantitySold),
      totalRevenue:      toFloat(r.totalRevenue),
    }));
  }

  // ─── Excel Export ─────────────────────────────────────────
  async generateExcelReport(opts: {
    type:       "monthly" | "yearly" | "custom";
    year?:      number;
    startDate?: string;
    endDate?:   string;
  }): Promise<any> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ExcelJS    = require("exceljs");
      const workbook   = new ExcelJS.Workbook();
      workbook.creator  = "TO ERP System";
      workbook.created  = new Date();
      workbook.modified = new Date();

      const year = opts.year ?? new Date().getFullYear();

      // ── Stil yordamchilar ───────────────────────────────
      const HEADER_STYLE = {
        font:      { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
        fill:      { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } } as any,
        alignment: { horizontal: "center", vertical: "middle" } as any,
        border: {
          top:    { style: "thin", color: { argb: "FFCCCCCC" } },
          bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
          left:   { style: "thin", color: { argb: "FFCCCCCC" } },
          right:  { style: "thin", color: { argb: "FFCCCCCC" } },
        } as any,
      };

      const currency = (val: number) =>
        `$${Number(val || 0).toLocaleString("uz-UZ", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

      const applyRowStyle = (row: any, bgColor?: string) => {
        row.eachCell({ includeEmpty: true }, (cell: any) => {
          if (bgColor) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
          }
          cell.border = {
            top:    { style: "thin", color: { argb: "FFEEEEEE" } },
            bottom: { style: "thin", color: { argb: "FFEEEEEE" } },
            left:   { style: "thin", color: { argb: "FFEEEEEE" } },
            right:  { style: "thin", color: { argb: "FFEEEEEE" } },
          };
        });
        row.height = 20;
      };

      // ══════════════════════════════════════════════════════
      // 1-SHEET: OYLIK TAHLIL
      // ══════════════════════════════════════════════════════
      const monthlySheet = workbook.addWorksheet("Oylik tahlil", {
        pageSetup: { orientation: "landscape", fitToPage: true },
      });

      monthlySheet.mergeCells("A1:H1");
      const titleCell       = monthlySheet.getCell("A1");
      titleCell.value       = `${year} — Oylik Savdo Tahlili`;
      titleCell.font        = { bold: true, size: 14, color: { argb: "FF1F4E79" } };
      titleCell.alignment   = { horizontal: "center", vertical: "middle" };
      monthlySheet.getRow(1).height = 30;

      monthlySheet.mergeCells("A2:H2");
      monthlySheet.getCell("A2").value     = `Yaratildi: ${new Date().toLocaleString("uz-UZ")}`;
      monthlySheet.getCell("A2").font      = { size: 9, color: { argb: "FF888888" } };
      monthlySheet.getCell("A2").alignment = { horizontal: "center" };

      monthlySheet.columns = [
        { key: "month",    width: 12 },
        { key: "revenue",  width: 18 },
        { key: "real",     width: 18 },
        { key: "profit",   width: 18 },
        { key: "margin",   width: 10 },
        { key: "sales",    width: 12 },
        { key: "refunds",  width: 18 },
        { key: "discount", width: 18 },
      ];

      const mHeader = monthlySheet.addRow([
        "Oy", "Tushum", "Haqiqiy tushum", "Sof foyda",
        "Margin %", "Savdolar soni", "Qaytarishlar", "Chegirmalar",
      ]);
      mHeader.eachCell((cell: any) => Object.assign(cell, HEADER_STYLE));
      mHeader.height = 25;

      const breakdown = await this.getMonthlyBreakdown(year);
      let totalRev = 0, totalReal = 0, totalProfit = 0,
          totalSales = 0, totalRefunds = 0, totalDiscount = 0;

      breakdown.forEach((m, i) => {
        const margin = m.realRevenue > 0
          ? Math.round((m.netProfit / m.realRevenue) * 100)
          : 0;

        const row = monthlySheet.addRow([
          m.label,
          currency(m.totalRevenue),
          currency(m.realRevenue),
          currency(m.netProfit),
          `${margin}%`,
          m.totalSales,
          m.totalRefunds > 0 ? currency(m.totalRefunds) : "—",
          currency(m.totalDiscount),
        ]);

        applyRowStyle(row, i % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF");

        if (i === new Date().getMonth()) {
          row.eachCell((cell: any) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } };
            cell.font = { bold: true };
          });
        }

        const marginCell = row.getCell(5);
        marginCell.font = {
          bold:  true,
          color: { argb: margin >= 20 ? "FF375623" : margin >= 0 ? "FFB45309" : "FFB91C1C" },
        };

        totalRev      += m.totalRevenue;
        totalReal     += m.realRevenue;
        totalProfit   += m.netProfit;
        totalSales    += m.totalSales;
        totalRefunds  += m.totalRefunds;
        totalDiscount += m.totalDiscount;
      });

      const totalMargin = totalReal > 0 ? Math.round((totalProfit / totalReal) * 100) : 0;
      const sumRow = monthlySheet.addRow([
        "JAMI",
        currency(totalRev),
        currency(totalReal),
        currency(totalProfit),
        `${totalMargin}%`,
        totalSales,
        totalRefunds > 0 ? currency(totalRefunds) : "—",
        currency(totalDiscount),
      ]);
      sumRow.eachCell((cell: any) => {
        cell.font   = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
        cell.border = HEADER_STYLE.border;
      });
      sumRow.height = 22;

      // ══════════════════════════════════════════════════════
      // 2-SHEET: TOP MAHSULOTLAR
      // ══════════════════════════════════════════════════════
      const productSheet = workbook.addWorksheet("Top mahsulotlar");

      productSheet.mergeCells("A1:G1");
      const pTitle       = productSheet.getCell("A1");
      pTitle.value       = `${year} — Top Mahsulotlar`;
      pTitle.font        = { bold: true, size: 14, color: { argb: "FF1F4E79" } };
      pTitle.alignment   = { horizontal: "center", vertical: "middle" };
      productSheet.getRow(1).height = 30;

      productSheet.columns = [
        { key: "rank",     width: 8  },
        { key: "name",     width: 35 },
        { key: "category", width: 20 },
        { key: "qty",      width: 15 },
        { key: "revenue",  width: 18 },
        { key: "profit",   width: 18 },
        { key: "margin",   width: 12 },
      ];

      const pHeader = productSheet.addRow([
        "#", "Mahsulot nomi", "Kategoriya",
        "Sotilgan miqdor", "Tushum", "Foyda", "Margin %",
      ]);
      pHeader.eachCell((cell: any) => Object.assign(cell, HEADER_STYLE));
      pHeader.height = 25;

      const startOfYear = new Date(year, 0, 1);
      const endOfYear   = new Date(year, 11, 31, 23, 59, 59);
      const products    = await this.getProductPerformance(startOfYear, endOfYear, 50);

      products.forEach((p, i) => {
        const row = productSheet.addRow([
          i + 1,
          p.productName,
          p.categoryName || "—",
          p.totalQuantitySold,
          currency(p.totalRevenue),
          currency(p.totalProfit),
          `${p.profitMargin}%`,
        ]);
        applyRowStyle(row, i % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF");

        if (i < 3) {
          row.getCell(1).font = {
            bold:  true,
            color: { argb: i === 0 ? "FFB45309" : i === 1 ? "FF6B7280" : "FFEA580C" },
          };
        }
      });

      // ══════════════════════════════════════════════════════
      // 3-SHEET: KATEGORIYALAR
      // ══════════════════════════════════════════════════════
      const catSheet = workbook.addWorksheet("Kategoriyalar");

      catSheet.mergeCells("A1:F1");
      const cTitle     = catSheet.getCell("A1");
      cTitle.value     = `${year} — Kategoriyalar bo'yicha`;
      cTitle.font      = { bold: true, size: 14, color: { argb: "FF1F4E79" } };
      cTitle.alignment = { horizontal: "center", vertical: "middle" };
      catSheet.getRow(1).height = 30;

      catSheet.columns = [
        { key: "name",     width: 25 },
        { key: "revenue",  width: 18 },
        { key: "profit",   width: 18 },
        { key: "margin",   width: 12 },
        { key: "sales",    width: 15 },
        { key: "products", width: 15 },
      ];

      const cHeader = catSheet.addRow([
        "Kategoriya", "Tushum", "Foyda", "Margin %", "Savdolar", "Mahsulotlar",
      ]);
      cHeader.eachCell((cell: any) => Object.assign(cell, HEADER_STYLE));
      cHeader.height = 25;

      const categories = await this.getCategoryPerformance(startOfYear, endOfYear);
      categories.forEach((c, i) => {
        const row = catSheet.addRow([
          c.categoryName,
          currency(c.totalRevenue),
          currency(c.totalProfit),
          `${c.profitMargin}%`,
          c.totalSales,
          c.productCount,
        ]);
        applyRowStyle(row, i % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF");

        const marginCell = row.getCell(4);
        marginCell.font = {
          bold:  true,
          color: {
            argb: c.profitMargin >= 20 ? "FF375623"
                : c.profitMargin >= 0  ? "FFB45309"
                : "FFB91C1C",
          },
        };
      });

      // ══════════════════════════════════════════════════════
      // 4-SHEET: UMUMIY XULOSA
      // ══════════════════════════════════════════════════════
      const summarySheet = workbook.addWorksheet("Xulosa");
      summarySheet.columns = [
        { key: "label", width: 30 },
        { key: "value", width: 25 },
      ];

      summarySheet.mergeCells("A1:B1");
      const sTitle     = summarySheet.getCell("A1");
      sTitle.value     = `${year} yil — Umumiy Xulosa`;
      sTitle.font      = { bold: true, size: 16, color: { argb: "FF1F4E79" } };
      sTitle.alignment = { horizontal: "center", vertical: "middle" };
      summarySheet.getRow(1).height = 35;

      const yearlyStats = await this.getStatistics(
        StatisticsPeriod.YEARLY,
        new Date(year, 6, 1).toISOString(),
      );

      const summaryRows: [string, string | number][] = [
        ["", ""],
        ["Umumiy tushum",     currency(yearlyStats.totalRevenue)],
        ["Umumiy chegirma",   currency(yearlyStats.totalDiscount)],
        ["Yalpi foyda",       currency(yearlyStats.grossProfit)],
        ["Sof foyda",         currency(yearlyStats.netProfit)],
        ["", ""],
        ["Naqd to'lovlar",    currency(yearlyStats.cashAmount)],
        ["Karta to'lovlar",   currency(yearlyStats.cardAmount)],
        ["Nasiya (qarz)",     currency(yearlyStats.debtAmount)],
        ["", ""],
        ["Jami sotuvlar",     `${yearlyStats.totalSales} ta`],
        ["O'rtacha sotuv",    currency(yearlyStats.averageSaleValue)],
        ["Sotilgan jami qty", String(yearlyStats.totalQuantitySold)],
      ];

      summaryRows.forEach(([label, value], i) => {
        const row = summarySheet.addRow([label, value]);
        if (!label) return;
        row.getCell(1).font      = { bold: true, size: 11 };
        row.getCell(2).font      = { size: 11, color: { argb: "FF1F4E79" } };
        row.getCell(2).alignment = { horizontal: "right" };
        applyRowStyle(row, i % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF");
        row.height = 22;
      });

      return workbook;
    } catch (error) {
      this.logger.error("generateExcelReport failed", error);
      throw new InternalServerErrorException("Excel hisobot yaratishda xatolik");
    }
  }
}