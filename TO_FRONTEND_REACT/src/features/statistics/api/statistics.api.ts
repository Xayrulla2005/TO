import { api } from '../../../shared/lib/axios';
import { DashboardStats, StatisticsSummary, TimeRange } from '@/shared/types/statistics';

export const statisticsApi = {
  getDashboardStats: async (date?: string) => {
    const { data } = await api.get<DashboardStats>('/statistics/dashboard', {
      params: { date },
    });
    return data;
  },
  getSummary: async (range: TimeRange, startDate?: string, endDate?: string) => {
    const { data } = await api.get<StatisticsSummary>('/statistics/summary', {
      params: { range, startDate, endDate },
    });
    return data;
  },
};