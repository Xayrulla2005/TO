import { api } from '../../../shared/lib/axios';

interface SaleItem {
  productId: string;
  quantity: number;
  customUnitPrice?: number;
  discountAmount?: number;
}

interface CreateSalePayload {
  items: SaleItem[];
  notes?: string;
}

interface CompleteSalePayload {
  payments: {
    method: 'CASH' | 'CARD' | 'DEBT';
    amount: number;
    notes?: string;
  }[];
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  debtorName?: string;
  debtorPhone?: string;
  debtDueDate?: string;
  debtNotes?: string;
  agreedTotal?: number;
}

export interface DebtSummary {
  previousDebt: number;
  currentSaleDebt: number;
  totalDebtAfter: number;
}

export interface CompletedSale {
  id: string;
  saleNumber: string;
  grandTotal: number;
  subtotal: number;
  totalDiscount: number;
  status: string;
  completedAt?: string;
  createdAt: string;
  debtSummary?: DebtSummary;
  [key: string]: unknown;
}

export const salesApi = {
  create: async (payload: CreateSalePayload): Promise<{ id: string; [key: string]: unknown }> => {
    const { data } = await api.post('/sales', payload);
    return data;
  },

  complete: async (saleId: string, payload: CompleteSalePayload): Promise<CompletedSale> => {
    const { data } = await api.post(`/sales/${saleId}/complete`, payload);
    return data;
  },

  downloadReceipt: async (saleId: string): Promise<Blob> => {
    const { data } = await api.get(`/sales/${saleId}/receipt`, { responseType: 'blob' });
    return data;
  },
};