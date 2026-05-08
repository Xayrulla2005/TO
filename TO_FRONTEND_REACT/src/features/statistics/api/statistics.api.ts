import { api } from '../../../shared/lib/axios';
import { DashboardStats, StatisticsSummary, TimeRange } from '../../../shared/types/statistics';

export const statisticsApi = {
  getDashboardStats: async (date?: string): Promise<DashboardStats> => {
    const { data } = await api.get<DashboardStats>('/statistics/dashboard', {
      params: date ? { date } : {},
    });
    return (data as any)?.data ?? data;
  },

  getSummary: async (range: TimeRange): Promise<StatisticsSummary> => {
    const { data } = await api.get<StatisticsSummary>('/statistics/summary', {
      params: { range },
    });
    return (data as any)?.data ?? data;
  },

  // ✅ YANGI: Excel yuklab olish
  exportExcel: async (
    type: 'monthly' | 'yearly' | 'custom' = 'yearly',
    year?: number,
  ): Promise<Blob> => {
    const { data } = await api.get('/statistics/export/excel', {
      params: { type, year: year ?? new Date().getFullYear() },
      responseType: 'blob',
    });
    return data;
  },
};