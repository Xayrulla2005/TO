import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/features/audit/api/audit.api';
import { Card } from '@/shared/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/Table';
import { Badge } from '@/shared/ui/Badge';
import { Input } from '@/shared/ui/Input';
import { LoadingSpinner } from '@/shared/ui/Loading';
import { Search, User, Clock, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  
  // Debounce could be added here for production
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', search],
    queryFn: () => auditApi.getAll({ search }),
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'success';
      case 'UPDATE': return 'info';
      case 'DELETE': return 'danger';
      case 'LOGIN': return 'default';
      case 'LOGOUT': return 'default';
      default: return 'default';
    }
  };

  if (isLoading) return <LoadingSpinner className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
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
            {logs?.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-gray-500 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium text-gray-900">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={12} className="text-gray-500" />
                    </div>
                    {log.userName}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getActionColor(log.action) as any}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-100">
                    {log.entity}
                  </span>
                </TableCell>
                <TableCell className="max-w-md truncate text-gray-600" title={log.details}>
                  {log.details}
                </TableCell>
              </TableRow>
            ))}
            {(!logs || logs.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <ShieldAlert size={48} className="mb-2 opacity-20" />
                    <p>No audit logs found matching your criteria.</p>
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