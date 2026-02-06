import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statisticsApi } from '@/features/statistics/api/statistics.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/Table';
import { Badge } from '@/shared/ui/Badge';
import { LoadingSpinner } from '@/shared/ui/Loading';
import { formatCurrency } from '@/shared/lib/utils';
import { 
  TrendingUp, Wallet, AlertCircle, 
  Package, ShoppingCart, ArrowUpRight 
} from 'lucide-react';
import { format } from 'date-fns';

export function DashboardPage() {
  const { user } = useAuthStore();
  const [date] = useState(new Date().toISOString().split('T')[0]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', date],
    queryFn: () => statisticsApi.getDashboardStats(date),
  });

  if (isLoading) return <LoadingSpinner className="h-96" />;

  const summaryCards = [
    { 
      label: 'Today Revenue', 
      value: stats?.todayRevenue || 0, 
      icon: TrendingUp, 
      color: 'text-green-600 bg-green-50' 
    },
    { 
      label: 'Gross Profit', 
      value: stats?.grossProfit || 0, 
      icon: ArrowUpRight, 
      color: 'text-indigo-600 bg-indigo-50' 
    },
    { 
      label: 'Cash Received', 
      value: stats?.cashTotal || 0, 
      icon: Wallet, 
      color: 'text-blue-600 bg-blue-50' 
    },
    { 
      label: 'Debt Given', 
      value: stats?.debtTotal || 0, 
      icon: AlertCircle, 
      color: 'text-red-600 bg-red-50' 
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back, {user?.name}</p>
        </div>
        <div className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-lg border border-gray-200">
          {format(new Date(), 'MMMM dd, yyyy')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(card.value)}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${card.color}`}>
                  <card.icon size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Latest transactions from POS</CardDescription>
          </CardHeader>
          <div className="max-h-[350px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.recentSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                      {format(new Date(sale.createdAt), 'HH:mm')}
                    </TableCell>
                    <TableCell>
                      {sale.customerName || 'Walk-in Customer'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        sale.paymentMethod === 'DEBT' ? 'danger' : 
                        sale.paymentMethod === 'MIXED' ? 'warning' : 'default'
                      }>
                        {sale.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900">
                      {formatCurrency(sale.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!stats?.recentSales || stats.recentSales.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No sales today yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle size={18} className="text-red-500" />
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <div className="max-h-[350px] overflow-auto">
            <div className="divide-y divide-gray-100">
              {stats?.lowStockProducts.map((product) => (
                <div key={product.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center text-gray-500">
                      <Package size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500">Stock: {product.stockQty}</p>
                    </div>
                  </div>
                  <Badge variant="danger" className="shrink-0">
                    Restock
                  </Badge>
                </div>
              ))}
              {(!stats?.lowStockProducts || stats.lowStockProducts.length === 0) && (
                <div className="p-8 text-center text-sm text-gray-500">
                  All products are well stocked.
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products (Today)</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Quantity Sold</TableHead>
              <TableHead className="text-right">Total Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats?.bestSellingProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium text-gray-900 flex items-center gap-2">
                  <ShoppingCart size={16} className="text-indigo-500" />
                  {product.name}
                </TableCell>
                <TableCell>{product.qty} units</TableCell>
                <TableCell className="text-right font-bold text-gray-900">
                  {formatCurrency(product.total)}
                </TableCell>
              </TableRow>
            ))}
            {(!stats?.bestSellingProducts || stats.bestSellingProducts.length === 0) && (
               <TableRow>
                 <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                   No sales data available.
                 </TableCell>
               </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}