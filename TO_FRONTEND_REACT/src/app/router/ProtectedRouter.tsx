// src/app/router/ProtectedRouter.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/model/auth.store';

interface Props {
  allowedRoles?: string[];
}

export function ProtectedRoute({ allowedRoles }: Props) {
  const { accessToken, user } = useAuthStore();

  // Token yo'q — login ga
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  // Role tekshirish
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // SALER admin sahifalariga kirmoqchi bo'lsa — /sales ga
    if (user.role === 'SALER') {
      return <Navigate to="/sales" replace />;
    }
    // Boshqa holat — /dashboard ga
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}