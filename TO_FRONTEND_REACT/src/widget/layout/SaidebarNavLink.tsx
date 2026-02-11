import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderTree,
  Users,
  BarChart3,
  FileText,
} from "lucide-react";

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  adminOnly?: boolean;
}

interface SidebarNavLinksProps {
  isAdmin?: boolean;
  onNavigate?: () => void;
}

export function SidebarNavLinks({
  isAdmin = false,
  onNavigate,
}: SidebarNavLinksProps) {
  const navItems: NavItem[] = [
    {
      to: "/dashboard",
      icon: <LayoutDashboard size={20} />,
      label: "Bosh sahifa",
      adminOnly: true, // ✅ SALER ko'rmaydi
    },
    {
      to: "/sales",
      icon: <ShoppingCart size={20} />,
      label: "Yangi savdo(POS)",
    },
    {
      to: "/products",
      icon: <Package size={20} />,
      label: "Mahsulotlar",
      adminOnly: true, // ✅ SALER ko'rmaydi
    },
    {
      to: "/categories",
      icon: <FolderTree size={20} />,
      label: "Kategoriyalar",
      adminOnly: true, // ✅ SALER ko'rmaydi
    },
    {
      to: "/customers",
      icon: <Users size={20} />,
      label: "Mijozlar",
    },
    {
      to: "/statistics",
      icon: <BarChart3 size={20} />,
      label: "Statistika",
      adminOnly: true, // ✅ SALER ko'rmaydi
    },
    {
      to: "/audit-logs",
      icon: <FileText size={20} />,
      label: "Audit Jurnali",
      adminOnly: true,
    },
    {
      to: "/users", // ✅ TUZATILDI: "users" → "/users"
      label: "Foydalanuvchilar",
      icon: <Users size={20} />,
      adminOnly: true, // ✅ SALER ko'rmaydi
    },
  ];

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="space-y-1">
      {visibleNavItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-indigo-50 text-indigo-600"
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            }`
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}