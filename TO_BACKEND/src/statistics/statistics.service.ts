// ============================================================
// src/statistics/statistics.service.ts - COMPLETE WITH SQL
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SaleEntity, SaleStatus } from '../sale/entities/sale.entity';
import { PaymentEntity, PaymentMethod } from '../payments/entities/payment.entity';
import { DebtEntity, DebtStatus } from '../debts/entities/debt.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { ReturnEntity, ReturnStatus } from '../return/entities/return.entity';

export enum StatisticsPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export interface StatisticsResult {
  period: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalQuantitySold: number;
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  totalDiscount: number;
  grossProfit: number;
  netProfit: number;
  totalSales: number;
  averageSaleValue: number;
  totalItems: number;
  avgItemsPerSale: number;
}

export interface DashboardSummary {
  today: StatisticsResult;
  thisWeek: StatisticsResult;
  thisMonth: StatisticsResult;
  totalProducts: number;
  totalCategories: number;
  lowStockProducts: number;
  pendingDebts: number;
  pendingReturns: number;
  totalDebtAmount: number;
  recentSales: Array<{
    id: string;
    saleNumber: string;
    status: string;
    grandTotal: number;
    createdAt: Date;
    createdByUsername: string;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  salesByStatus: Record<string, number>;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  categoryName: string;
  totalQuantitySold: number;
  totalRevenue: number;
  totalProfit: number;
  averagePrice: number;
  salesCount: number;
}

export interface CategoryPerformance {
  categoryId: string;
  categoryName: string;
  totalRevenue: number;
  totalProfit: number;
  productCount: number;
  totalSales: number;
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

  // ─── Date Range Helpers ─────────────────────────────────
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
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return {
          startDate: start,
          endDate: end,
          label: start.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        };
      }
      case StatisticsPeriod.WEEKLY: {
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return {
          startDate: monday,
          endDate: sunday,
          label: `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        };
      }
      case StatisticsPeriod.MONTHLY: {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return {
          startDate: start,
          endDate: end,
          label: start.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        };
      }
      case StatisticsPeriod.YEARLY: {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return {
          startDate: start,
          endDate: end,
          label: String(now.getFullYear()),
        };
      }
      default:
        return this.getDateRange(StatisticsPeriod.DAILY, now);
    }
  }

  // ─── Core Statistics Query with Optimized SQL ───────────
  async getStatistics(
    period: StatisticsPeriod,
    referenceDate?: string,
    customStart?: string,
    customEnd?: string,
  ): Promise<StatisticsResult> {
    const ref = referenceDate ? new Date(referenceDate) : undefined;
    const cStart = customStart ? new Date(customStart) : undefined;
    const cEnd = customEnd ? new Date(customEnd) : undefined;
    const { startDate, endDate, label } = this.getDateRange(period, ref, cStart, cEnd);

    // Single optimized query with aggregations
    const result = await this.saleRepository
      .createQueryBuilder('sale')
      .select('COUNT(sale.id)', 'totalSales')
      .addSelect('COALESCE(SUM(sale.grand_total), 0)', 'totalRevenue')
      .addSelect('COALESCE(SUM(sale.total_discount), 0)', 'totalDiscount')
      .addSelect('COALESCE(SUM(sale.gross_profit), 0)', 'grossProfit')
      .addSelect('COALESCE(SUM(sale.net_profit), 0)', 'netProfit')
      .where('sale.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('sale.completed_at BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();

    // Get quantity sold from sale items
    const quantityResult = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.items', 'item')
      .select('COALESCE(SUM(item.quantity), 0)', 'totalQuantity')
      .addSelect('COUNT(DISTINCT item.id)', 'totalItems')
      .where('sale.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('sale.completed_at BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();

    // Get payment method breakdown
    const paymentsResult = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoin('payment.sale', 'sale')
      .select('payment.method', 'method')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'amount')
      .where('sale.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('sale.completed_at BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('payment.method')
      .getRawMany();

    let cashAmount = 0;
    let cardAmount = 0;
    let debtAmount = 0;

    for (const payment of paymentsResult) {
      const amount = parseFloat(payment.amount);
      if (payment.method === PaymentMethod.CASH) cashAmount = amount;
      if (payment.method === PaymentMethod.CARD) cardAmount = amount;
      if (payment.method === PaymentMethod.DEBT) debtAmount = amount;
    }

    const totalSales = parseInt(result.totalSales, 10);
    const totalRevenue = parseFloat(result.totalRevenue);
    const averageSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    const totalItems = parseInt(quantityResult.totalItems, 10);
    const avgItemsPerSale = totalSales > 0 ? totalItems / totalSales : 0;

    return {
      period,
      periodLabel: label,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalQuantitySold: Math.round(parseFloat(quantityResult.totalQuantity) * 100) / 100,
      cashAmount: Math.round(cashAmount * 100) / 100,
      cardAmount: Math.round(cardAmount * 100) / 100,
      debtAmount: Math.round(debtAmount * 100) / 100,
      totalDiscount: Math.round(parseFloat(result.totalDiscount) * 100) / 100,
      grossProfit: Math.round(parseFloat(result.grossProfit) * 100) / 100,
      netProfit: Math.round(parseFloat(result.netProfit) * 100) / 100,
      totalSales,
      averageSaleValue: Math.round(averageSaleValue * 100) / 100,
      totalItems,
      avgItemsPerSale: Math.round(avgItemsPerSale * 100) / 100,
    };
  }

  // ─── Dashboard Summary with Multiple Queries ────────────
  async getDashboardSummary(): Promise<DashboardSummary> {
    const [today, thisWeek, thisMonth] = await Promise.all([
      this.getStatistics(StatisticsPeriod.DAILY),
      this.getStatistics(StatisticsPeriod.WEEKLY),
      this.getStatistics(StatisticsPeriod.MONTHLY),
    ]);

    // Count aggregations
    const [totalProducts, totalCategories, lowStockCount, pendingDebtsCount, pendingReturnsCount] = await Promise.all([
      this.productRepository.count(),
      this.categoryRepository.count(),
      this.productRepository
        .createQueryBuilder('product')
        .where('product.stock_quantity <= product.min_stock_limit')
        .andWhere('product.deleted_at IS NULL')
        .getCount(),
      this.debtRepository.count({ where: { status: DebtStatus.PENDING } }),
      this.returnRepository.count({ where: { status: ReturnStatus.PENDING } }),
    ]);

    // Total debt amount
    const debtSum = await this.debtRepository
      .createQueryBuilder('debt')
      .select('COALESCE(SUM(debt.remaining_amount), 0)', 'total')
      .where('debt.status IN (:...statuses)', { statuses: [DebtStatus.PENDING, DebtStatus.PARTIALLY_PAID] })
      .getRawOne();

    // Recent sales
    const recentSales = await this.saleRepository.find({
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    // Top products (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topProducts = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.items', 'item')
      .leftJoin('item.product', 'product')
      .select('product.id', 'productId')
      .addSelect('item.product_name_snapshot', 'productName')
      .addSelect('SUM(item.quantity)', 'quantitySold')
      .addSelect('SUM(item.custom_total)', 'revenue')
      .where('sale.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('sale.completed_at >= :date', { date: thirtyDaysAgo })
      .groupBy('product.id, item.product_name_snapshot')
      .orderBy('SUM(item.quantity)', 'DESC')
      .limit(5)
      .getRawMany();

    // Sales by status
    const salesByStatus = await this.saleRepository
      .createQueryBuilder('sale')
      .select('sale.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sale.status')
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
      lowStockProducts: lowStockCount,
      pendingDebts: pendingDebtsCount,
      pendingReturns: pendingReturnsCount,
      totalDebtAmount: parseFloat(debtSum.total),
      recentSales: recentSales.map((s) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        status: s.status,
        grandTotal: Number(s.grandTotal),
        createdAt: s.createdAt,
        createdByUsername: s.createdBy.username,
      })),
      topProducts: topProducts.map((p) => ({
        productId: p.productId || '',
        productName: p.productName || 'Unknown',
        quantitySold: parseFloat(p.quantitySold),
        revenue: parseFloat(p.revenue),
      })),
      salesByStatus: statusMap,
    };
  }

  // ─── Monthly Breakdown (for charts) ─────────────────────
  async getMonthlyBreakdown(year: number): Promise<StatisticsResult[]> {
    const results: StatisticsResult[] = [];

    for (let month = 0; month < 12; month++) {
      const refDate = new Date(year, month, 15);
      const stats = await this.getStatistics(StatisticsPeriod.MONTHLY, refDate.toISOString());
      results.push(stats);
    }

    return results;
  }

  // ─── Product Performance Report ─────────────────────────
  async getProductPerformance(startDate: Date, endDate: Date, limit = 20): Promise<ProductPerformance[]> {
    const results = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.items', 'item')
      .leftJoin('item.product', 'product')
      .select('product.id', 'productId')
      .addSelect('item.product_name_snapshot', 'productName')
      .addSelect('item.category_snapshot', 'categoryName')
      .addSelect('SUM(item.quantity)', 'totalQuantitySold')
      .addSelect('SUM(item.custom_total)', 'totalRevenue')
      .addSelect('SUM((item.custom_unit_price - item.purchase_price_snapshot) * item.quantity)', 'totalProfit')
      .addSelect('AVG(item.custom_unit_price)', 'averagePrice')
      .addSelect('COUNT(DISTINCT sale.id)', 'salesCount')
      .where('sale.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('sale.completed_at BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('product.id, item.product_name_snapshot, item.category_snapshot')
      .orderBy('SUM(item.custom_total)', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      productId: r.productId || '',
      productName: r.productName || 'Unknown',
      categoryName: r.categoryName || 'Uncategorized',
      totalQuantitySold: parseFloat(r.totalQuantitySold),
      totalRevenue: parseFloat(r.totalRevenue),
      totalProfit: parseFloat(r.totalProfit),
      averagePrice: parseFloat(r.averagePrice),
      salesCount: parseInt(r.salesCount, 10),
    }));
  }

  // ─── Category Performance Report ────────────────────────
  async getCategoryPerformance(startDate: Date, endDate: Date): Promise<CategoryPerformance[]> {
    const results = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.items', 'item')
      .select('item.category_snapshot', 'categoryName')
      .addSelect('SUM(item.custom_total)', 'totalRevenue')
      .addSelect('SUM((item.custom_unit_price - item.purchase_price_snapshot) * item.quantity)', 'totalProfit')
      .addSelect('COUNT(DISTINCT item.product_id)', 'productCount')
      .addSelect('COUNT(DISTINCT sale.id)', 'totalSales')
      .where('sale.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('sale.completed_at BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('item.category_snapshot')
      .orderBy('SUM(item.custom_total)', 'DESC')
      .getRawMany();

    return results.map((r) => ({
      categoryId: '', // Not available in snapshot
      categoryName: r.categoryName || 'Uncategorized',
      totalRevenue: parseFloat(r.totalRevenue),
      totalProfit: parseFloat(r.totalProfit),
      productCount: parseInt(r.productCount, 10),
      totalSales: parseInt(r.totalSales, 10),
    }));
  }

  // ─── Sales Trend Analysis ───────────────────────────────
  async getSalesTrend(days = 30): Promise<Array<{ date: string; sales: number; revenue: number }>> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const results = await this.saleRepository
      .createQueryBuilder('sale')
      .select("DATE(sale.completed_at AT TIME ZONE 'UTC')", 'date')
      .addSelect('COUNT(*)', 'sales')
      .addSelect('SUM(sale.grand_total)', 'revenue')
      .where('sale.status = :status', { status: SaleStatus.COMPLETED })
      .andWhere('sale.completed_at BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('DATE(sale.completed_at AT TIME ZONE \'UTC\')')
      .orderBy('date', 'ASC')
      .getRawMany();

    return results.map((r) => ({
      date: r.date,
      sales: parseInt(r.sales, 10),
      revenue: parseFloat(r.revenue),
    }));
  }
}