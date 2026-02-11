// src/pages/DebtsPage.tsx
import { useState } from 'react';
import { useDebts } from '../features/debts/hooks/useDebts';
import { Card } from '../shared/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../shared/ui/Table';
import { Badge } from '../shared/ui/Badge';
import { Input } from '../shared/ui/Input';
import { LoadingSpinner } from '../shared/ui/Loading';
import { Search, DollarSign, User } from 'lucide-react';
import { format } from 'date-fns';
import { PayDebtModal } from '../features/debts/companent/PayDeptModal';

export function DebtsPage() {
  const [search, setSearch] = useState('');
  const [selectedDebt, setSelectedDebt] = useState<string | null>(null);
  
  const { data: debts = [], isLoading } = useDebts();

  const filteredDebts = debts.filter((debt) =>
    debt.customerName.toLowerCase().includes(search.toLowerCase()) ||
    debt.customerPhone.includes(search)
  );

  const totalDebt = debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Qarzlar</h1>
          <p className="text-gray-500">Qarzga savdo qilingan mijozlar ro'yxati</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-red-50 px-4 py-2 rounded-lg">
            <div className="text-sm text-red-600">Jami qarz</div>
            <div className="text-xl font-bold text-red-900">
              {totalDebt.toLocaleString()} UZS
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input 
            placeholder="Ism yoki telefon bo'yicha qidirish..." 
            icon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mijoz</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Jami summa</TableHead>
              <TableHead>To'langan</TableHead>
              <TableHead>Qoldiq</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDebts.map((debt) => (
              <TableRow key={debt.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={16} className="text-gray-500" />
                    </div>
                    <span className="font-medium">{debt.customerName}</span>
                  </div>
                </TableCell>
                <TableCell>{debt.customerPhone}</TableCell>
                <TableCell className="font-medium">
                  {debt.totalAmount.toLocaleString()} UZS
                </TableCell>
                <TableCell className="text-green-600">
                  {debt.paidAmount.toLocaleString()} UZS
                </TableCell>
                <TableCell className="text-red-600 font-medium">
                  {debt.remainingAmount.toLocaleString()} UZS
                </TableCell>
                <TableCell>
                  <Badge variant={debt.status === 'PAID' ? 'success' : 'warning'}>
                    {debt.status === 'PAID' ? 'TO\'LIQ' : 'QISMAN'}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500">
                  {format(new Date(debt.createdAt), 'dd.MM.yyyy')}
                </TableCell>
                <TableCell>
                  {debt.status !== 'PAID' && (
                    <button
                      onClick={() => setSelectedDebt(debt.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      To'lash
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredDebts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <DollarSign size={48} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-500">Qarzlar topilmadi</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pay Debt Modal */}
      {selectedDebt && (
        <PayDebtModal
          debtId={selectedDebt}
          onClose={() => setSelectedDebt(null)}
        />
      )}
    </div>
  );
}