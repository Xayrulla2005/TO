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
  // Mavjud mijoz ID si
  customerId?: string;
  // Yangi mijoz
  customerName?: string;
  customerPhone?: string;
  // Backward compat
  debtorName?: string;
  debtorPhone?: string;
  debtDueDate?: string;
  debtNotes?: string;
  agreedTotal?: number;
}

export const salesApi = {
  create: async (payload: CreateSalePayload) => {
    const { data } = await api.post('/sales', payload);
    return data;
  },

  complete: async (saleId: string, payload: CompleteSalePayload) => {
    const { data } = await api.post(`/sales/${saleId}/complete`, payload);
    return data;
  },

  downloadReceipt: async (saleId: string) => {
    const { data } = await api.get(`/sales/${saleId}/receipt`, { responseType: 'blob' });
    return data;
  },
};