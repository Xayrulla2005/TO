import { api } from '../../../shared/lib/axios';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  totalDebt: number;   // ✅ backend dan keladi
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
}

export interface SaleItem {
  id: string;
  productNameSnapshot: string;
  quantity: number;
  customUnitPrice: number;
  customTotal: number;
  discountAmount: number;
  unitSnapshot: string;
}

export interface Payment {
  id: string;
  method: 'CASH' | 'CARD' | 'DEBT';
  amount: number;
}

export interface Debt {
  id: string;
  originalAmount: number;
  remainingAmount: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  debtorName: string;
  debtorPhone: string;
}

export const customersApi = {
  getAll: async (search?: string): Promise<Customer[]> => {
    const { data } = await api.get('/customers', { params: search ? { search } : {} });
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
};