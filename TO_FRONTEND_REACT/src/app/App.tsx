import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from '@/shared/ui/Toast';
import { ProtectedRoute } from './router/ProtectedRouter';
import { AppLayout } from '../widget/layout/AppLayout';

import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SalesPage } from '../pages/Sales.page';
import { ProductsPage } from '../pages/ProductsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { StatisticsPage } from '@/pages/StatisticsPage';
import { AuditLogsPage } from '@/pages/AuditLogsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route element={<AppLayout />}>
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Route>
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}