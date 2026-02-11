// src/features/debts/api/debts.api.ts
import { api } from '../../../shared/lib/axios';
import type { Debt } from '../../../shared/types/debt.types';

export type MakeDebtPaymentDto = {
  amount: number;
  paymentMethod: 'CASH' | 'CARD';
  note?: string;
};

export const debtsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ data: Debt[]; total: number; page: number; limit: number }> => {
    const { data } = await api.get('/debts', { params });

    // backend PaginatedResponseDto qaytaradi:
    // { data: [], total, page, limit }
    if (data?.data && Array.isArray(data.data)) return data;

    // fallback
    return { data: Array.isArray(data) ? data : [], total: 0, page: 1, limit: 20 };
  },

  makePayment: async (debtId: string, dto: MakeDebtPaymentDto): Promise<Debt> => {
    const { data } = await api.post(`/debts/${debtId}/payment`, dto);
    return data?.data || data;
  },
};
