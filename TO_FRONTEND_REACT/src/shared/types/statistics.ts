import { Product } from './product';

export interface DashboardStats {
  todaySalesCount: number;
  todayRevenue: number;
  cashTotal: number;
  cardTotal: number;
  debtTotal: number;
  grossProfit: number;
  lowStockProducts: Product[];
  bestSellingProducts: {
    id: string;
    name: string;
    qty: number;
    total: number;
  }[];
  recentSales: {
    id: string;
    total: number;
    paymentMethod: 'CASH' | 'CARD' | 'DEBT' | 'MIXED';
    createdAt: string;
    customerName?: string;
  }[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface StatisticsSummary {
  revenue: number;
  profit: number;
  ordersCount: number;
  paymentSplit: {
    cash: number;
    card: number;
    debt: number;
  };
  chartData: ChartDataPoint[];
  topProducts: {
    id: string;
    name: string;
    sold: number;
    revenue: number;
  }[];
}

export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';