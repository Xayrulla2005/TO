import { api } from '../../../shared/lib/axios';

export interface AuditLogParams {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entity?: string;
}

export interface AuditLogsResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
}

export const auditApi = {
  getAll: async (params?: AuditLogParams): Promise<AuditLogsResponse> => {
    try {
      const { data } = await api.get('/audit-logs', { params });

      // Backend { data: [], total: N } formatida qaytarsa
      if (data.data && Array.isArray(data.data)) {
        return {
          data: data.data,
          total: data.total ?? data.data.length,
          page: data.page ?? params?.page ?? 1,
          limit: data.limit ?? params?.limit ?? 50,
        };
      }

      // Backend to'g'ridan array qaytarsa
      if (Array.isArray(data)) {
        return {
          data,
          total: data.length,
          page: params?.page ?? 1,
          limit: params?.limit ?? 50,
        };
      }

      // { items: [] } formati
      if (data.items && Array.isArray(data.items)) {
        return {
          data: data.items,
          total: data.total ?? data.items.length,
          page: params?.page ?? 1,
          limit: params?.limit ?? 50,
        };
      }

      console.warn('Unexpected audit logs response format:', data);
      return { data: [], total: 0, page: 1, limit: 50 };
    } catch (error) {
      console.error('Get audit logs error:', error);
      throw error;
    }
  },
};