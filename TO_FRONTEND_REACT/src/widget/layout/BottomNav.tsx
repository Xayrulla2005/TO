import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export function BottomNav() {
  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Boshsahifa' },
    { to: '/sales', icon: ShoppingCart, label: 'Sotish' },
    { to: '/products', icon: Package, label: 'Mahsulotlar' },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-30">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => cn(
            "flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium",
            isActive ? "text-primary-600" : "text-gray-500"
          )}
        >
          <link.icon size={24} />
          {link.label}
        </NavLink>
      ))}
    </div>
  );
}