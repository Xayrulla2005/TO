import { api } from '../../../shared/lib/axios';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  totalDebt: number;
  oldestDebtAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerStats {
  totalSales: number;
  totalAmount: number;
  totalDebt: number;
  averageOrderValue: number;
  monthlyStats: Record<string, { count: number; amount: number }>;
}

export interface CustomerSalesHistory {
  data: Sale[];
  total: number;
  page: number;
  limit: number;
}

export interface SaleItem {
  id: string;
  productNameSnapshot: string;
  quantity: number;
  customUnitPrice: number;
  baseUnitPrice: number;
  customTotal: number;
  discountAmount: number;
  unitSnapshot: string;
}

export interface Payment {
  id: string;
  method: 'CASH' | 'CARD' | 'DEBT';
  amount: number;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  paymentMethod: 'CASH' | 'CARD';
  note?: string | null;
  remainingBefore: number;
  remainingAfter: number;
  createdAt: string;
}

export interface Debt {
  id: string;
  originalAmount: number;
  remainingAmount: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  debtorName: string;
  debtorPhone: string;
  payments?: DebtPayment[];
}

export interface ReturnItem {
  id: string;
  saleItemId: string;
  productName: string;
  quantity: number;
  refundUnitPrice: number;
  refundTotal: number;
  reason?: string;
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  refundAmount: number;
  reason?: string;
  notes?: string;
  createdAt: string;
  items: ReturnItem[];
}

export interface Sale {
  id: string;
  saleNumber: string;
  grandTotal: number;
  subtotal: number;
  totalDiscount: number;
  status: string;
  completedAt?: string;
  createdAt: string;
  items: SaleItem[];
  payments: Payment[];
  debt?: Debt;
  returns?: SaleReturn[];
}

export const customersApi = {
  getAll: async (search?: string): Promise<Customer[]> => {
    const params: Record<string, unknown> = { limit: 9999 };
    if (search) params.search = search;
    const { data } = await api.get('/customers', { params });
    return data;
  },

  getOne: async (id: string): Promise<Customer> => {
    const { data } = await api.get(`/customers/${id}`);
    return data;
  },

  create: async (payload: { name: string; phone: string; notes?: string }): Promise<Customer> => {
    const { data } = await api.post('/customers', payload);
    return data;
  },

  update: async (id: string, payload: { name?: string; phone?: string; notes?: string }): Promise<Customer> => {
    const { data } = await api.put(`/customers/${id}`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/customers/${id}`);
  },

  getSales: async (id: string, page = 1, limit = 20): Promise<CustomerSalesHistory> => {
    const { data } = await api.get(`/customers/${id}/sales`, { params: { page, limit } });
    return data as CustomerSalesHistory;
  },

  getStats: async (id: string): Promise<CustomerStats> => {
    const { data } = await api.get(`/customers/${id}/stats`);
    return data;
  },

  createReturn: async (payload: {
    originalSaleId: string;
    reason?: string;
    notes?: string;
    items: { saleItemId: string; quantity: number; reason?: string }[];
  }): Promise<SaleReturn> => {
    const { data } = await api.post('/returns', payload);
    return data;
  },

  getReturnReceipt: async (returnId: string): Promise<Blob> => {
    const { data } = await api.get(`/returns/${returnId}/receipt`, { responseType: 'blob' });
    return data;
  },
};