// src/features/auth/model/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean; // ✅ Qo'shildi
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false, // ✅ Default qiymat
      
      login: (user, token) => {
        console.log('🔐 Login:', { user, accessToken: token });
        
        // ✅ localStorage ga saqlash
        localStorage.setItem('accessToken', token);
        
        console.log('✅ Token localStorage ga saqlandi');
        console.log('🔑 Tekshirish:', localStorage.getItem('accessToken'));
        
        set({ 
          user, 
          accessToken: token,
          isAuthenticated: true // ✅ True ga o'zgaradi
        });
      },
      
      logout: () => {
        console.log('🔓 Logout');
        localStorage.removeItem('accessToken');
        set({ 
          user: null, 
          accessToken: null,
          isAuthenticated: false // ✅ False ga qaytadi
        });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);