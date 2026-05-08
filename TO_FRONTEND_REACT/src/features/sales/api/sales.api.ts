// src/features/sales/api/sales.api.ts
import { api } from '../../../shared/lib/axios';

// ─────────────────────────────────────────────────────────────
// REQUEST TYPES
// ─────────────────────────────────────────────────────────────
export interface CreateSaleItem {
  productId:        string;
  quantity:         number;
  customUnitPrice?: number;
  discountAmount?:  number;
}

export interface CreateSalePayload {
  items: CreateSaleItem[];
  notes?: string;
}

export interface CompleteSalePayment {
  method: 'CASH' | 'CARD' | 'DEBT';
  amount: number;
  notes?: string;
}

export interface CompleteSalePayload {
  payments:       CompleteSalePayment[];
  customerId?:    string;
  customerName?:  string;
  customerPhone?: string;
  debtorName?:    string;
  debtorPhone?:   string;
  debtDueDate?:   string;
  debtNotes?:     string;
  agreedTotal?:   number;
}

// ─────────────────────────────────────────────────────────────
// RESPONSE TYPES
// ─────────────────────────────────────────────────────────────
export interface DebtSummary {
  previousDebt:    number;
  currentSaleDebt: number;
  totalDebtAfter:  number;
}

export interface SaleDraftResponse {
  id:          string;
  saleNumber:  string;
  status:      string;
  grandTotal:  number;
  subtotal:    number;
  totalDiscount: number;
  createdAt:   string;
  [key: string]: unknown;
}

export interface CompletedSale {
  id:            string;
  saleNumber:    string;
  grandTotal:    number;
  subtotal:      number;
  totalDiscount: number;
  netProfit?:    number;
  grossProfit?:  number;
  status:        string;
  completedAt?:  string;
  createdAt:     string;
  debtSummary?:  DebtSummary;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
export const salesApi = {
  // 1-qadam: DRAFT sotuv yaratish
  create: async (payload: CreateSalePayload): Promise<SaleDraftResponse> => {
    const { data } = await api.post('/sales', payload);
    // ✅ Backend wrapper qabul qilish: { data: {...} } yoki to'g'ridan object
    const result = (data as any)?.data ?? data;
    if (!result?.id) {
      throw new Error('DRAFT savdo yaratilmadi — id yo\'q');
    }
    return result;
  },

  // 2-qadam: DRAFT ni yakunlash
  complete: async (
    saleId: string,
    payload: CompleteSalePayload,
  ): Promise<CompletedSale> => {
    const { data } = await api.post(`/sales/${saleId}/complete`, payload);
    return (data as any)?.data ?? data;
  },

  // Savdolar ro'yxati
  getAll: async (params?: {
    page?:   number;
    limit?:  number;
    search?: string;
    status?: string;
  }) => {
    const { data } = await api.get('/sales', {
      params: { limit: 20, ...params },
    });
    return (data as any)?.data ?? data;
  },

  // Bitta savdo
  getOne: async (saleId: string): Promise<CompletedSale> => {
    const { data } = await api.get(`/sales/${saleId}`);
    return (data as any)?.data ?? data;
  },

  // Chekni PDF blob sifatida yuklash
  downloadReceipt: async (saleId: string): Promise<Blob> => {
    const { data } = await api.get(`/sales/${saleId}/receipt`, {
      responseType: 'blob',
    });
    return data;
  },

  // Sotuvni bekor qilish (faqat ADMIN)
  cancel: async (saleId: string, reason: string) => {
    const { data } = await api.post(`/sales/${saleId}/cancel`, { reason });
    return (data as any)?.data ?? data;
  },
};