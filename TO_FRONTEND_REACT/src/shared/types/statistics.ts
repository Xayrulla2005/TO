export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ChartPoint {
  label:    string;
  value:    number;
  refunds?: number;
}

export interface PaymentSplit {
  cash: number;
  card: number;
  debt: number;
}

export interface StatisticsSummary {
  // Tushum
  revenue:      number;
  realRevenue:  number;   // ✅ qaytarishlar chiqarilgan

  // Foyda
  profit:       number;
  realProfit:   number;   // ✅ qaytarishlar chiqarilgan
  grossProfit:  number;
  margin:       number;   // ✅ foiz

  // Buyurtmalar
  ordersCount:  number;
  avgOrder:     number;

  // Qaytarishlar
  totalRefunds: number;   // ✅
  refundCount:  number;   // ✅

  // Chart
  chartData:    ChartPoint[];

  // To'lovlar
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
    unit?:    string;
  }>;
  bestSellingProducts: Array<{
    id:    string;
    name:  string;
    qty:   number;
    total: number;
    unit?: string;
  }>;
}