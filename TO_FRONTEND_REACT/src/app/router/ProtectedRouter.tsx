// src/app/router/ProtectedRouter.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/model/auth.store';

interface Props {
  allowedRoles?: string[];
}

export function ProtectedRoute({ allowedRoles }: Props) {
  const { accessToken, user } = useAuthStore(); // ✅ isAuthenticated o'rniga accessToken

  console.log('🛡️ ProtectedRoute check:', { accessToken: !!accessToken, user, allowedRoles }); // Debug

  // ✅ Token yo'q bo'lsa login ga yo'naltirish
  if (!accessToken) {
    console.log('❌ Token yo\'q, login ga yo\'naltirilmoqda');
    return <Navigate to="/login" replace />;
  }

  // ✅ Role tekshirish
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    console.log('❌ Ruxsat yo\'q, dashboard ga yo\'naltirilmoqda');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('✅ Ruxsat berildi');
  return <Outlet />;
}
