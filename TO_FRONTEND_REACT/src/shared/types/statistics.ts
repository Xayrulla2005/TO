export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface DashboardStats {
  todayRevenue: number;
  grossProfit: number;
  cashTotal: number;
  debtTotal: number;
  recentSales: Array<{
    id: string;
    createdAt: string;
    customerName: string | null;
    paymentMethod: string;
    total: number;
  }>;
  lowStockProducts: Array<{
    id: string;
    name: string;
    stockQty: number;
  }>;
  bestSellingProducts: Array<{
    id: string;
    name: string;
    qty: number;
    total: number;
  }>;
}

export interface StatisticsSummary {
  revenue: number;
  profit: number;
  ordersCount: number;
  chartData: Array<{
    label: string;
    value: number;
  }>;
  paymentSplit: {
    cash: number;
    card: number;
    debt: number;
  };
}