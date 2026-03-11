import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../features/audit/api/audit.api';
import { Card } from '../shared/ui/Card';
import { Input } from '../shared/ui/Input';
import { LoadingSpinner } from '../shared/ui/Loading';
import { Search, ShieldAlert, Receipt, Package, User, CreditCard, RotateCcw, LogIn, Settings } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { formatCurrency } from '../shared/lib/utils';

// Faqat kerakli amallar
const IMPORTANT_ACTIONS = [
  'SALE_CREATED', 'SALE_COMPLETED', 'SALE_CANCELLED',
  'PRICE_OVERRIDE', 'DISCOUNT_APPLIED',
  'RETURN_CREATED', 'RETURN_APPROVED', 'RETURN_REJECTED',
  'PAYMENT_RECORDED', 'DEBT_PAYMENT', 'DEBT_CANCELLED',
  'INVENTORY_ADJUSTED', 'STOCK_DECREASED', 'STOCK_INCREASED',
  'CREATED', 'UPDATED', 'DELETED',
  'LOGIN', 'LOGOUT', 'PASSWORD_CHANGED',
];

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  SALE_COMPLETED:     { label: 'Sotuv',          color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: Receipt },
  SALE_CREATED:       { label: 'Sotuv boshlandi', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',       icon: Receipt },
  SALE_CANCELLED:     { label: 'Sotuv bekor',     color: 'text-red-700',    bg: 'bg-red-50 border-red-200',         icon: Receipt },
  PRICE_OVERRIDE:     { label: 'Narx o\'zgartirildi', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: CreditCard },
  DISCOUNT_APPLIED:   { label: 'Chegirma',        color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200',   icon: CreditCard },
  PAYMENT_RECORDED:   { label: 'To\'lov',         color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CreditCard },
  DEBT_PAYMENT:       { label: 'Qarz to\'lovi',   color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',       icon: CreditCard },
  DEBT_CANCELLED:     { label: 'Qarz bekor',      color: 'text-red-700',    bg: 'bg-red-50 border-red-200',         icon: CreditCard },
  RETURN_CREATED:     { label: 'Qaytarish',       color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200',   icon: RotateCcw },
  RETURN_APPROVED:    { label: 'Qaytarish tasdiqlandi', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: RotateCcw },
  RETURN_REJECTED:    { label: 'Qaytarish rad',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200',         icon: RotateCcw },
  STOCK_DECREASED:    { label: 'Stok kamaydi',    color: 'text-red-700',    bg: 'bg-red-50 border-red-200',         icon: Package },
  STOCK_INCREASED:    { label: 'Stok ko\'paydi',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: Package },
  INVENTORY_ADJUSTED: { label: 'Inventar',        color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',       icon: Package },
  CREATED:            { label: 'Yaratildi',       color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',       icon: Settings },
  UPDATED:            { label: 'Yangilandi',      color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',     icon: Settings },
  DELETED:            { label: 'O\'chirildi',     color: 'text-red-700',    bg: 'bg-red-50 border-red-200',         icon: Settings },
  LOGIN:              { label: 'Kirish',          color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',       icon: LogIn },
  LOGOUT:             { label: 'Chiqish',         color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',       icon: LogIn },
  PASSWORD_CHANGED:   { label: 'Parol o\'zgardi', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',     icon: User },
};

const ENTITY_LABELS: Record<string, string> = {
  SALE: 'Sotuv', SALE_ITEM: 'Sotuv', PAYMENT: "To'lov",
  DEBT: 'Qarz', RETURN: 'Qaytarish', PRODUCT: 'Mahsulot',
  CATEGORY: 'Kategoriya', USER: 'Foydalanuvchi',
  INVENTORY: 'Inventar', AUTH: 'Tizim',
};

// Filter tabs
const FILTER_TABS = [
  { key: 'all',       label: 'Barchasi' },
  { key: 'sales',     label: 'Sotuvlar',    actions: ['SALE_COMPLETED', 'SALE_CREATED', 'SALE_CANCELLED', 'PRICE_OVERRIDE', 'DISCOUNT_APPLIED'] },
  { key: 'payments',  label: "To'lovlar",   actions: ['PAYMENT_RECORDED', 'DEBT_PAYMENT', 'DEBT_CANCELLED'] },
  { key: 'returns',   label: 'Qaytarishlar',actions: ['RETURN_CREATED', 'RETURN_APPROVED', 'RETURN_REJECTED'] },
  { key: 'stock',     label: 'Stok',        actions: ['STOCK_DECREASED', 'STOCK_INCREASED', 'INVENTORY_ADJUSTED'] },
  { key: 'system',    label: 'Tizim',       actions: ['LOGIN', 'LOGOUT', 'PASSWORD_CHANGED', 'CREATED', 'UPDATED', 'DELETED'] },
];

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const { data: logsRaw, isLoading, error } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => auditApi.getAll({ limit: 500 } as any),
    retry: 1,
  });

  const formatDate = (log: any) => {
    const dateValue = log.createdAt || log.timestamp;
    if (!dateValue) return 'N/A';
    try {
      const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
      if (isValid(date)) return format(date, 'dd.MM.yyyy HH:mm');
      return 'N/A';
    } catch { return 'N/A'; }
  };

  const getUserName = (log: any) => {
    if (log.user?.fullName) return log.user.fullName;
    if (log.user?.username) return log.user.username;
    if (log.userName) return log.userName;
    return 'Tizim';
  };

  const getDetails = (log: any) => {
    const meta = log.metadata || {};
    const after = log.afterSnapshot || {};
    const before = log.beforeSnapshot || {};

    // Sotuv
    if (['SALE_COMPLETED', 'SALE_CREATED'].includes(log.action)) {
      const total = meta.totalAmount || after.totalAmount || meta.grandTotal;
      const items = meta.itemCount || after.itemCount;
      const customer = meta.customerName || meta.debtorName;
      const saleNum = meta.saleNumber || after.saleNumber;
      return (
        <div className="flex flex-wrap gap-2 text-xs">
          {saleNum && <span className="font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded">#{saleNum}</span>}
          {total !== undefined && <span className="font-semibold text-emerald-700">{formatCurrency(total)}</span>}
          {items && <span className="text-gray-500">{items} ta mahsulot</span>}
          {customer && <span className="text-blue-600">👤 {customer}</span>}
        </div>
      );
    }

    // To'lov
    if (['PAYMENT_RECORDED', 'DEBT_PAYMENT'].includes(log.action)) {
      const amount = meta.amount || after.amount;
      const method = meta.method || after.method;
      const methodLabel: Record<string, string> = { CASH: 'Naqd', CARD: 'Karta', DEBT: 'Qarz' };
      return (
        <div className="flex gap-2 text-xs">
          {amount && <span className="font-semibold text-emerald-700">{formatCurrency(amount)}</span>}
          {method && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{methodLabel[method] || method}</span>}
        </div>
      );
    }

    // Narx o'zgarishi
    if (log.action === 'PRICE_OVERRIDE') {
      const oldPrice = before.salePrice || meta.oldPrice;
      const newPrice = after.salePrice || meta.newPrice;
      return (
        <div className="flex gap-2 text-xs items-center">
          {oldPrice && <span className="line-through text-gray-400">{formatCurrency(oldPrice)}</span>}
          {newPrice && <span className="font-semibold text-orange-700">→ {formatCurrency(newPrice)}</span>}
        </div>
      );
    }

    // Stok
    if (['STOCK_DECREASED', 'STOCK_INCREASED', 'INVENTORY_ADJUSTED'].includes(log.action)) {
      const qty = meta.quantity || meta.qty || meta.amount;
      const productName = meta.productName || after.name;
      return (
        <div className="flex gap-2 text-xs">
          {productName && <span className="text-gray-700">{productName}</span>}
          {qty !== undefined && (
            <span className={log.action === 'STOCK_DECREASED' ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
              {log.action === 'STOCK_DECREASED' ? '-' : '+'}{qty}
            </span>
          )}
        </div>
      );
    }

    // Qaytarish
    if (log.action.startsWith('RETURN')) {
      const amount = meta.totalAmount || after.totalAmount;
      const reason = meta.reason || after.reason;
      return (
        <div className="flex gap-2 text-xs">
          {amount && <span className="font-semibold text-orange-700">{formatCurrency(amount)}</span>}
          {reason && <span className="text-gray-500">{reason}</span>}
        </div>
      );
    }

    // Default: metadata yoki description
    const desc = log.description || meta.description || meta.name || after.name || '';
    return desc ? <span className="text-xs text-gray-500">{String(desc)}</span> : null;
  };

  if (isLoading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;

  if (error) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <ShieldAlert size={48} className="mx-auto mb-4 text-red-400" />
        <p className="text-red-600">Xatolik: {String((error as any)?.message || 'Yuklashda muammo')}</p>
      </div>
    </div>
  );

  const allLogs = Array.isArray(logsRaw) ? logsRaw : [];

  // Filter by tab
  const tabConfig = FILTER_TABS.find(t => t.key === activeTab);
  let filtered = allLogs.filter((log: any) => IMPORTANT_ACTIONS.includes(log.action));
  if (tabConfig?.actions) filtered = filtered.filter((log: any) => tabConfig.actions!.includes(log.action));

  // Filter by search
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((log: any) =>
      getUserName(log).toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.entity?.toLowerCase().includes(q) ||
      JSON.stringify(log.metadata || {}).toLowerCase().includes(q)
    );
  }

  // Group by date
  const grouped: Record<string, any[]> = {};
  filtered.forEach((log: any) => {
    const dateValue = log.createdAt || log.timestamp;
    let dateKey = 'Noma\'lum sana';
    try {
      const d = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
      if (isValid(d)) dateKey = format(d, 'dd MMMM yyyy');
    } catch {}
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(log);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sotuv Jurnali</h1>
          <p className="text-gray-500 text-sm">{filtered.length} ta yozuv</p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Qidirish..."
            icon={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Logs grouped by date */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ShieldAlert size={48} className="mb-3 opacity-20" />
            <p>Yozuvlar topilmadi</p>
          </div>
        </Card>
      ) : (
        Object.entries(grouped).map(([dateKey, logs]) => (
          <div key={dateKey} className="space-y-2">
            {/* Date header */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{dateKey}</span>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">{logs.length} ta</span>
            </div>

            {/* Log cards */}
            <div className="space-y-1.5">
              {logs.map((log: any) => {
                const cfg = ACTION_CONFIG[log.action] || {
                  label: log.action, color: 'text-gray-700',
                  bg: 'bg-gray-50 border-gray-200', icon: Settings
                };
                const Icon = cfg.icon;
                const details = getDetails(log);
                const entityLabel = ENTITY_LABELS[log.entity] || log.entity;

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${cfg.bg} transition-all`}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>
                      <Icon size={16} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{entityLabel}</span>
                        {details && (
                          <>
                            <span className="text-xs text-gray-400">·</span>
                            {details}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <User size={11} />
                        <span>{getUserName(log)}</span>
                        <span>·</span>
                        <span>{formatDate(log)}</span>
                        {log.ipAddress && (
                          <>
                            <span>·</span>
                            <span className="font-mono">{log.ipAddress}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
