import { api } from '@/shared/lib/axios';
import { AuditLog, AuditLogParams } from '@/shared/types/audit';

export const auditApi = {
  getAll: async (params?: AuditLogParams) => {
    const { data } = await api.get<AuditLog[]>('/audit-logs', { params });
    return data;
  },
};