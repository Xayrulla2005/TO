export interface AuditLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'SALE';
  userId: string;
  userName: string;
  entity: string;
  entityId?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface AuditLogParams {
  search?: string;
  startDate?: string;
  endDate?: string;
}