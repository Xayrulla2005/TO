import { api } from '../../../shared/lib/axios';
import { DashboardStats, StatisticsSummary, TimeRange } from '../../../shared/types/statistics';

export const statisticsApi = {
  getDashboardStats: async (date?: string): Promise<DashboardStats> => {
    const { data } = await api.get<DashboardStats>('/statistics/dashboard', {
      params: { date },
    });
    return data;
  },

  getSummary: async (range: TimeRange): Promise<StatisticsSummary> => {
    const { data } = await api.get<StatisticsSummary>('/statistics/summary', {
      params: { range },
    });
    return data;
  },
};