import { useAuthStore } from '@/features/auth/model/auth.store';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

// ✅ Search va Bell olib tashlandi
export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        onClick={onMenuClick}
      >
        <span className="sr-only">Open sidebar</span>
        <Menu size={24} />
      </button>

      {/* ✅ Faqat user info qoldi */}
      <div className="flex items-center gap-3 ml-auto">
        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
          {user?.fullName?.trim()?.[0]?.toUpperCase() || 'U'}
        </div>
        <span className="hidden lg:block text-sm font-semibold text-gray-900">
          {user?.fullName}
        </span>
      </div>
    </header>
  );
}