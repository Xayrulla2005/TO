import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { cn } from '@/shared/lib/utils';
import { 
  LayoutDashboard, ShoppingCart, Package, Tags, 
  Users, BarChart3, FileText, Settings, LogOut, 
  DollarSign
} from 'lucide-react';

export function Sidebar({ isMobile = false }: { isMobile?: boolean }) {
  const { user, logout } = useAuthStore();
  
  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Boshsahifa', roles: ['ADMIN', 'SALER'] },
    { to: '/sales', icon: ShoppingCart, label: 'Yangi Savdo (POS)', roles: ['ADMIN', 'SALER'] },
    { to: '/products', icon: Package, label: 'Mahsulotlar', roles: ['ADMIN', 'SALER'] },
    { to: '/categories', icon: Tags, label: 'Kategoriyalar', roles: ['ADMIN', 'SALER'] },
    { to: '/customers', icon: Users, label: 'Mijozlar', roles: ['ADMIN', 'SALER'] },
    { to: '/statistics', icon: BarChart3, label: 'Statistika', roles: ['ADMIN', 'SALER'] },
    { to: '/audit-logs', icon: FileText, label: 'Audit Jurnali', roles: ['ADMIN'] },
    { to: '/settings', icon: Settings, label: 'Sozlamalar', roles: ['ADMIN'] },
    { to: '/debts', icon: DollarSign, label: 'Qarzlar' }
  ];

  const content = (
    <div className="flex h-full flex-col bg-white">
      {!isMobile && (
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
            E
          </div>
          <span className="text-xl font-bold text-gray-900">ERP Tizimi</span>
        </div>
      )}

      <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
        {links.map((link) => {
          if (link.roles && user && !link.roles.includes(user.role)) return null;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => cn(
                "group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <link.icon size={20} className={cn("shrink-0 transition-colors")} />
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <button 
          onClick={() => {
            logout();
            window.location.href = '/login';
          }}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut size={20} />
          Chiqish
        </button>
      </div>
    </div>
  );

  if (isMobile) return content;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-gray-200 lg:block">
      {content}
    </aside>
  );
}