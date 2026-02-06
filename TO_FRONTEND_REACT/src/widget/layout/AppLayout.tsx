import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileDrawer } from "./MobileDrawer";
import { BottomNav } from './BottomNav';
import { Header } from './Heard';

export function AppLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Mobile Drawer */}
      <MobileDrawer isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-[260px]">
        <Header onMenuClick={() => setIsMobileOpen(true)} />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 overflow-x-hidden">
          <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}