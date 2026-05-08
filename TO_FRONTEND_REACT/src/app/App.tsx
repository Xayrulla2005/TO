import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from '../shared/ui/Toast';
import { ProtectedRoute } from './router/ProtectedRouter';
import { AppLayout } from '../widget/layout/AppLayout';
import { UsersPage } from '../pages/UserPage';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { SalesPage } from '../pages/SalesPage';
import { ProductsPage } from '../pages/ProductsPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { StatisticsPage } from '../pages/StatisticsPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { CustomersPage } from '../pages/CustomersPage';
import { useAuthStore } from '../features/auth/model/auth.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ✅ 5 daqiqa — page o'zgarishida VPS ga so'rov QAYTA YUKLANMAYDI
      staleTime: 5 * 60 * 1000,
      // ✅ 15 daqiqa — keshdan o'chmasin
      gcTime: 15 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

function RoleBasedRedirect() {
  const { user } = useAuthStore();
  if (user?.role === 'SALER') return <Navigate to="/sales" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* ADMIN only */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Route>

          {/* ADMIN + SALER */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'SALER']} />}>
            <Route element={<AppLayout />}>
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
            </Route>
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<RoleBasedRedirect />} />
          </Route>
          <Route path="*" element={<ProtectedRoute />}>
            <Route path="*" element={<RoleBasedRedirect />} />
          </Route>
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}