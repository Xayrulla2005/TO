import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../features/audit/api/audit.api';
import { api } from '../shared/lib/axios';
import { Input } from '../shared/ui/Input';
import { Modal } from '../shared/ui/Modal';
import { toast } from '../shared/ui/Toast';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { uz } from 'date-fns/locale';
import { Search, ShoppingBag, RotateCcw, User, Package, AlertTriangle, FileText } from 'lucide-react';
import { useEffect } from 'react';

const ACTION_CONFIG: Record<string, {
  label: string; icon: any; iconColor: string; bgColor: string; borderColor: string;
}> = {
  SALE_COMPLETED: {
    label: 'Sotuv', icon: ShoppingBag,
    iconColor: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-100',
  },
  DEBT_PAYMENT: {
    label: "Qarz to'lovi", icon: AlertTriangle,
    iconColor: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-100',
  },
  SALE_RETURNED: {
    label: 'Qaytarish', icon: RotateCcw,
    iconColor: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-100',
  },
  STOCK_ADJUSTED: {
    label: 'Stok', icon: Package,
    iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-100',
  },
  USER_CREATED: {
    label: 'Tizim', icon: User,
    iconColor: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-100',
  },
};

const DEFAULT_CONFIG = {
  label: 'Amal', icon: ShoppingBag, iconColor: 'text-gray-500',
  bgColor: 'bg-gray-50', borderColor: 'border-gray-100',
};

const TABS = [
  { key: 'all', label: 'Barchasi' },
  { key: 'SALE_COMPLETED', label: 'Sotuvlar' },
  { key: 'DEBT_PAYMENT', label: "To'lovlar" },
  { key: 'SALE_RETURNED', label: 'Qaytarishlar' },
  { key: 'STOCK_ADJUSTED', label: 'Stok' },
  { key: 'USER_CREATED', label: 'Tizim' },
];

function groupByDate(logs: any[]) {
  const groups = new Map<string, any[]>();
  for (const log of logs) {
    const dateStr = log.createdAt.slice(0, 10);
    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr)!.push(log);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => {
      const d = parseISO(date);
      let label = format(d, 'dd MMMM yyyy', { locale: uz });
      if (isToday(d)) label = 'Bugun';
      else if (isYesterday(d)) label = 'Kecha';
      return { label, date, items };
    });
}

function fmtAmount(val: number | null | undefined) {
  if (!val) return null;
  return '$' + Number(val).toLocaleString('uz-UZ');
}

// ─── Receipt Modal — sale yoki debt uchun ─────────────────────
function ReceiptModal({ type, id, number, amount }: {
  type: 'sale' | 'debt';
  id: string;
  number: string;
  amount?: number;
}) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = type === 'sale'
      ? `/sales/${id}/receipt`
      : `/debts/${id}/receipt${amount ? `?amount=${amount}` : ''}`;

    api
      .get(url, { responseType: 'blob' })
      .then((res) => {
        const blobUrl = window.URL.createObjectURL(
          new Blob([res.data], { type: 'application/pdf' })
        );
        setReceiptUrl(blobUrl);
      })
      .catch(() => toast.error('Chek yuklanmadi'))
      .finally(() => setLoading(false));

    return () => {
      if (receiptUrl) window.URL.revokeObjectURL(receiptUrl);
    };
  }, [id, type]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : receiptUrl ? (
        <>
          <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: '60vh' }}>
            <iframe src={receiptUrl} className="w-full h-full" title={`Chek #${number}`} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const iframe = document.querySelector('iframe') as HTMLIFrameElement;
                iframe?.contentWindow?.print();
              }}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm"
            >Print</button>
            <a
              href={receiptUrl}
              download={`chek-${number}.pdf`}
              className="flex-1 bg-gray-100 text-gray-700 text-center py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center"
            >PDF yuklash</a>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-400 py-8">Chek topilmadi</p>
      )}
    </div>
  );
}

// ─── Log Row ──────────────────────────────────────────────────
function LogRow({ log, onOpen }: {
  log: any;
  onOpen: (info: { type: 'sale' | 'debt'; id: string; number: string; amount?: number }) => void;
}) {
  const action = log.action as string;
  const cfg = ACTION_CONFIG[action] ?? DEFAULT_CONFIG;
  const Icon = cfg.icon;

  const snap = log.afterSnapshot ?? {};
  const meta = log.metadata ?? {};

  // Mijoz/qarzdor ismi
  const customerName =
    snap.customerName || meta.customerName ||
    snap.debtorName || meta.debtorName || null;

  const saleNumber = snap.saleNumber || meta.saleNumber || null;
  const grandTotal = snap.grandTotal ?? snap.amount ?? meta.amount ?? null;
  const paymentAmount = snap.paymentAmount ?? meta.paymentAmount ?? null;

  // Chek ko'rsatish mumkinmi?
  const canViewReceipt =
    (action === 'SALE_COMPLETED' || action === 'DEBT_PAYMENT') && log.entityId;

  const handleClick = () => {
    if (!canViewReceipt) return;
    if (action === 'SALE_COMPLETED') {
      onOpen({
        type: 'sale',
        id: log.entityId,
        number: saleNumber ?? log.entityId.slice(0, 8),
      });
    } else if (action === 'DEBT_PAYMENT') {
      onOpen({
        type: 'debt',
        id: log.entityId,
        number: log.entityId.slice(0, 8),
        amount: paymentAmount ?? undefined,
      });
    }
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl border ${cfg.borderColor} transition-all ${
        canViewReceipt ? 'cursor-pointer hover:shadow-md hover:border-indigo-200' : 'hover:shadow-sm'
      }`}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bgColor}`}>
        <Icon size={16} className={cfg.iconColor} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{cfg.label}</span>
          {saleNumber && <span className="text-xs text-gray-400">#{saleNumber}</span>}

          {customerName ? (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
              <User size={10} />{customerName}
            </span>
          ) : action === 'SALE_COMPLETED' ? (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-medium">
              Naqd
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-400">
            {log.user?.fullName || log.user?.username || "Noma'lum"}
          </p>
          <span className="text-gray-200">·</span>
          <p className="text-xs text-gray-400">
            {format(parseISO(log.createdAt), 'HH:mm')}
          </p>
          {canViewReceipt && (
            <>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-indigo-400 flex items-center gap-0.5">
                <FileText size={11} /> Chek
              </span>
            </>
          )}
        </div>
      </div>

      {/* Summa */}
      <div className="text-right flex-shrink-0">
        {action === 'DEBT_PAYMENT' && paymentAmount ? (
          <p className="font-bold text-sm text-amber-600">{fmtAmount(paymentAmount)}</p>
        ) : grandTotal ? (
          <p className="font-bold text-sm text-gray-900">{fmtAmount(grandTotal)}</p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [receipt, setReceipt] = useState<{
    type: 'sale' | 'debt'; id: string; number: string; amount?: number;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, activeTab],
    queryFn: () => auditApi.getAll({
      page,
      limit: 50,
      search: search || undefined,
      action: activeTab !== 'all' ? activeTab : undefined,
    }),
  });

  const logs: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;

  const filtered = activeTab === 'all'
    ? logs.filter(l => Object.keys(ACTION_CONFIG).includes(l.action))
    : logs;

  const grouped = groupByDate(filtered);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sotuv Jurnali</h1>
        <p className="text-gray-500 text-sm">{total} ta yozuv</p>
      </div>

      <Input
        placeholder="Qidirish..."
        icon={<Search size={16} />}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === key
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShoppingBag size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">Yozuvlar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">{group.items.length} ta</span>
              </div>
              <div className="space-y-1.5">
                {group.items.map((log: any) => (
                  <LogRow key={log.id} log={log} onOpen={setReceipt} />
                ))}
              </div>
            </div>
          ))}

          {total > 50 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-indigo-300 transition-colors"
              >Oldingi</button>
              <span className="text-sm text-gray-500">
                {page} / {Math.ceil(total / 50)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 50)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-indigo-300 transition-colors"
              >Keyingi</button>
            </div>
          )}
        </div>
      )}

      {/* Receipt Modal — sale va debt uchun ikkala turdagi chek */}
      <Modal
        isOpen={!!receipt}
        onClose={() => setReceipt(null)}
        title={receipt?.type === 'debt' ? "Qarz to'lov cheki" : `Sotuv cheki #${receipt?.number ?? ''}`}
        size="md"
      >
        {receipt && (
          <ReceiptModal
            type={receipt.type}
            id={receipt.id}
            number={receipt.number}
            amount={receipt.amount}
          />
        )}
      </Modal>
    </div>
  );
}