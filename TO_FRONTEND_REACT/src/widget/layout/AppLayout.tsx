import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/model/auth.store';
import { Menu, X, LogOut } from 'lucide-react';
import { SidebarNavLinks } from './SaidebarNavLink';

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const roleLabel = isAdmin ? 'Admin' : 'Sotuvchi';
  const roleBadgeClass = isAdmin
    ? 'bg-indigo-100 text-indigo-700'
    : 'bg-emerald-100 text-emerald-700';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <span className="font-bold text-gray-900">Tanirovka Optom</span>
        </div>

        <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
          <span className="text-indigo-600 font-semibold text-sm">
            {user?.fullName?.trim()?.[0]?.toUpperCase() || 'U'}
          </span>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={closeMobileMenu}
          />
          <div className="md:hidden fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-50 overflow-y-auto">
            <div className="p-4 space-y-6">
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded ${roleBadgeClass}`}>
                  {roleLabel}
                </span>
              </div>
              <SidebarNavLinks isAdmin={isAdmin} onNavigate={closeMobileMenu} />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={20} />
                <span>Chiqish</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 flex-col z-30">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-200">
          <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <span className="font-bold text-xl text-gray-900">Tanirovka Optom</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <SidebarNavLinks isAdmin={isAdmin} />
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            <span>Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="md:ml-64">
        <header className="hidden md:flex sticky top-0 h-16 bg-white border-b border-gray-200 z-20 items-center justify-end px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-semibold">
                {user?.fullName?.trim()?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ml-1 ${roleBadgeClass}`}>
              {roleLabel}
            </span>
          </div>
        </header>

        <main className="p-6 mt-16 md:mt-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}