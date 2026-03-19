export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ChartPoint {
  label: string;
  value: number;
  refunds?: number;
}

export interface PaymentSplit {
  cash: number;
  card: number;
  debt: number;
}

export interface StatisticsSummary {
  revenue:      number;
  profit:       number;
  ordersCount:  number;
  avgOrder?:    number;
  realRevenue?:  number;
  realProfit?:   number;
  totalRefunds?: number;
  refundCount?:  number;
  chartData:    ChartPoint[];
  paymentSplit: PaymentSplit;
}

export interface DashboardStats {
  todayRevenue:  number;
  grossProfit:   number;
  netProfit?:    number;
  cashTotal:     number;
  cardTotal?:    number;
  debtTotal:     number;
  totalRefunds?: number;
  refundCount?:  number;
  pendingReturns?: number;
  recentSales: Array<{
    id:            string;
    createdAt:     string;
    customerName:  string | null;
    paymentMethod: string;
    total:         number;
  }>;
  lowStockProducts: Array<{
    id:       string;
    name:     string;
    stockQty: number;
  }>;
  bestSellingProducts: Array<{
    id:    string;
    name:  string;
    qty:   number;
    total: number;
  }>;
}