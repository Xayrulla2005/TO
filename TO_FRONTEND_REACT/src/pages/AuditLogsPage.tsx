import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../features/audit/api/audit.api';
import { Card } from '../shared/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../shared/ui/Table';
import { Badge } from '../shared/ui/Badge';
import { Input } from '../shared/ui/Input';
import { LoadingSpinner } from '../shared/ui/Loading';
import { Search, User, Clock, ShieldAlert } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['audit-logs', search],
    queryFn: () => auditApi.getAll({ search }),
    retry: 1,
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'success';
      case 'UPDATE': return 'info';
      case 'DELETE': return 'danger';
      case 'LOGIN': return 'default';
      case 'LOGOUT': return 'default';
      case 'TOKEN_REFRESHED': return 'default';
      default: return 'default';
    }
  };

  // Safe date formatting - turli formatlarni qo'llab-quvvatlaydi
  const formatDate = (log: any) => {
    // Turli timestamp field nomlari
    const dateValue = log.timestamp || log.createdAt || log.date || log.created_at;
    
    if (!dateValue) return 'N/A';
    
    try {
      let date;
      
      // ISO string
      if (typeof dateValue === 'string') {
        date = parseISO(dateValue);
      } 
      // Unix timestamp (milliseconds)
      else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      }
      // Date object
      else if (dateValue instanceof Date) {
        date = dateValue;
      }
      
      if (date && isValid(date)) {
        return format(date, 'yyyy-MM-dd HH:mm:ss');
      }
      
      return 'Invalid date';
    } catch (error) {
      console.error('Date format error:', error, dateValue);
      return 'Invalid date';
    }
  };

  // Safe user name extraction
  const getUserName = (log: any) => {
    // Turli user field strukturalari
    if (log.userName) return log.userName;
    if (log.user_name) return log.user_name;
    if (log.user?.fullName) return log.user.fullName;
    if (log.user?.name) return log.user.name;
    if (log.user?.username) return log.user.username;
    if (log.username) return log.username;
    if (log.performedBy) return log.performedBy;
    
    return 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto mb-4 text-red-400" />
          <p className="text-red-600">
            Xatolik yuz berdi: {String((error as any)?.message || 'Ma\'lumotlarni yuklashda muammo')}
          </p>
        </div>
      </div>
    );
  }

  const safeLogs = Array.isArray(logs) ? logs : [];

  // DEBUG: Console'da ko'rish
  if (safeLogs.length > 0) {
    console.log('First log sample:', safeLogs[0]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Jurnali</h1>
          <p className="text-gray-500">Security trail of all system activities.</p>
        </div>
        <div className="w-full md:w-80">
          <Input 
            placeholder="Search logs by user, action or entity..." 
            icon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeLogs.map((log: any) => (
              <TableRow key={log.id}>
                <TableCell className="text-gray-500 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    {formatDate(log)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium text-gray-900">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={12} className="text-gray-500" />
                    </div>
                    {getUserName(log)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getActionColor(String(log.action)) as any}>
                    {String(log.action)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-100">
                    {String(log.entity || log.entityType || 'N/A')}
                  </span>
                </TableCell>
                <TableCell className="max-w-md truncate text-gray-600" title={String(log.details || log.description || '')}>
                  {String(log.details || log.description || '')}
                </TableCell>
              </TableRow>
            ))}
            {safeLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <ShieldAlert size={48} className="mb-2 opacity-20" />
                    <p>Audit yozuvlari topilmadi.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}