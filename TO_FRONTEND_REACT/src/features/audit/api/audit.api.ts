import { api } from '../../../shared/lib/axios'; // Bu to'g'ri - auth store'dan token oladi
import type { AuditLogParams } from '../../../shared/types/audit';

export const auditApi = {
  getAll: async (params?: AuditLogParams) => {
    try {
      const { data } = await api.get('/audit-logs', { params });
      
      // Backend formatini tekshirish
      if (data.data && Array.isArray(data.data)) {
        return data.data;
      }
      
      if (Array.isArray(data)) {
        return data;
      }
      
      if (data.items && Array.isArray(data.items)) {
        return data.items;
      }
      
      console.warn('Unexpected audit logs response format:', data);
      return [];
    } catch (error) {
      console.error('Get audit logs error:', error);
      throw error;
    }
  },
};