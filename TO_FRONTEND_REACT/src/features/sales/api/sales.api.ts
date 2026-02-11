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
  debtorName?: string;
  debtorPhone?: string;
  debtDueDate?: string;
  debtNotes?: string;
}



export const salesApi = {
  // DRAFT yaratish
  create: async (payload: CreateSalePayload) => {
    const { data } = await api.post('/sales', payload);
    return data;
  },

  // To'lovni amalga oshirish
  complete: async (saleId: string, payload: CompleteSalePayload) => {
    const { data } = await api.post(`/sales/${saleId}/complete`, payload);
    return data;
  },
  
};