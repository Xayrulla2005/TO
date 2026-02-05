// src/services/statistics.service.ts
import axios from 'axios';

export const statisticsService = {
  async getDashboardStats() {
    const { data } = await axios.get('/api/statistics/dashboard');
    return data;
  },

  async getSalesStats(value: string) {
    const { data } = await axios.get('/api/statistics/sales');
    return data;
  },
};
