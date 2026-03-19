import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { auditApi } from '../features/audit/api/audit.api';
import { api } from '../shared/lib/axios';
import { Input } from '../shared/ui/Input';
import { Modal } from '../shared/ui/Modal';
import { toast } from '../shared/ui/Toast';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { uz } from 'date-fns/locale';
import {
  Search, ShoppingBag, RotateCcw, User, Package,
  AlertTriangle, FileText, TrendingDown, Settings, LogIn,
  Check, X, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import { useEffect } from 'react';

const ACTION_CONFIG: Record<string, {
  label: string; icon: any; iconColor: string; bgColor: string; borderColor: string;
}> = {
  SALE_COMPLETED:   { label: 'Sotuv',              icon: ShoppingBag,   iconColor: 'text-indigo-600', bgColor: 'bg-indigo-50',  borderColor: 'border-indigo-100' },
  SALE_CREATED:     { label: 'Sotuv (draft)',       icon: ShoppingBag,   iconColor: 'text-indigo-400', bgColor: 'bg-indigo-50',  borderColor: 'border-indigo-100' },
  SALE_CANCELLED:   { label: 'Sotuv bekor',         icon: ShoppingBag,   iconColor: 'text-red-400',    bgColor: 'bg-red-50',     borderColor: 'border-red-100' },
  DEBT_PAYMENT:     { label: "Qarz to'lovi",        icon: AlertTriangle, iconColor: 'text-amber-600',  bgColor: 'bg-amber-50',   borderColor: 'border-amber-100' },
  DEBT_CANCELLED:   { label: 'Qarz bekor',          icon: AlertTriangle, iconColor: 'text-red-500',    bgColor: 'bg-red-50',     borderColor: 'border-red-100' },
  RETURN_CREATED:   { label: 'Qaytarish',           icon: RotateCcw,     iconColor: 'text-purple-500', bgColor: 'bg-purple-50',  borderColor: 'border-purple-100' },
  RETURN_APPROVED:  { label: 'Qaytarish tasdiqlandi', icon: RotateCcw,   iconColor: 'text-green-600',  bgColor: 'bg-green-50',   borderColor: 'border-green-100' },
  RETURN_REJECTED:  { label: 'Qaytarish rad',       icon: RotateCcw,     iconColor: 'text-gray-500',   bgColor: 'bg-gray-50',    borderColor: 'border-gray-100' },
  SALE_RETURNED:    { label: 'Qaytarish',           icon: RotateCcw,     iconColor: 'text-purple-500', bgColor: 'bg-purple-50',  borderColor: 'border-purple-100' },
  INVENTORY_ADJUSTED: { label: 'Stok',             icon: Package,       iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-100' },
  STOCK_ADJUSTED:   { label: 'Stok',               icon: Package,       iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-100' },
  STOCK_DECREASED:  { label: 'Stok kamaydi',       icon: TrendingDown,  iconColor: 'text-orange-500',  bgColor: 'bg-orange-50',  borderColor: 'border-orange-100' },
  STOCK_INCREASED:  { label: "Stok ko'paydi",      icon: Package,       iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-100' },
  USER_CREATED:     { label: 'Foydalanuvchi',      icon: User,          iconColor: 'text-gray-500',    bgColor: 'bg-gray-50',    borderColor: 'border-gray-100' },
  LOGIN:            { label: 'Kirish',             icon: LogIn,         iconColor: 'text-gray-500',    bgColor: 'bg-gray-50',    borderColor: 'border-gray-100' },
  LOGOUT:           { label: 'Chiqish',            icon: LogIn,         iconColor: 'text-gray-400',    bgColor: 'bg-gray-50',    borderColor: 'border-gray-100' },
  CREATED:          { label: "Qo'shildi",          icon: Settings,      iconColor: 'text-gray-500',    bgColor: 'bg-gray-50',    borderColor: 'border-gray-100' },
  UPDATED:          { label: 'Yangilandi',         icon: Settings,      iconColor: 'text-gray-500',    bgColor: 'bg-gray-50',    borderColor: 'border-gray-100' },
  DELETED:          { label: "O'chirildi",         icon: Settings,      iconColor: 'text-red-400',     bgColor: 'bg-red-50',     borderColor: 'border-red-100' },
  PASSWORD_CHANGED: { label: "Parol o'zgardi",     icon: Settings,      iconColor: 'text-gray-500',    bgColor: 'bg-gray-50',    borderColor: 'border-gray-100' },
  PRICE_OVERRIDE:   { label: "Narx o'zgardi",      icon: ShoppingBag,   iconColor: 'text-orange-500',  bgColor: 'bg-orange-50',  borderColor: 'border-orange-100' },
  DISCOUNT_APPLIED: { label: 'Chegirma',           icon: ShoppingBag,   iconColor: 'text-indigo-500',  bgColor: 'bg-indigo-50',  borderColor: 'border-indigo-100' },
  PAYMENT_RECORDED: { label: "To'lov",             icon: AlertTriangle, iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-100' },
};

const DEFAULT_CONFIG = {
  label: 'Amal', icon: Settings, iconColor: 'text-gray-500',
  bgColor: 'bg-gray-50', borderColor: 'border-gray-100',
};

const TABS = [
  { key: 'all',           label: 'Barchasi' },
  { key: 'SALE_COMPLETED',label: 'Sotuvlar' },
  { key: 'DEBT_PAYMENT',  label: "To'lovlar" },
  { key: 'SALE_RETURNED', label: 'Qaytarishlar' },
  { key: 'USER_CREATED',  label: 'Tizim' },
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
  if (val == null) return null;
  return '$' + Number(val).toLocaleString('uz-UZ');
}

// ─── Return Receipt Modal ─────────────────────────────────────
function ReturnReceiptModal({ returnId, returnNumber }: { returnId: string; returnNumber: string }) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    api.get(`/returns/${returnId}/receipt`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        setReceiptUrl(objectUrl);
      })
      .catch(() => toast.error('Chek yuklanmadi'))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) window.URL.revokeObjectURL(objectUrl); };
  }, [returnId]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      ) : receiptUrl ? (
        <>
          <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: '60vh' }}>
            <iframe src={receiptUrl} className="w-full h-full" title={`Qaytarish cheki #${returnNumber}`} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { const f = document.querySelector('iframe') as HTMLIFrameElement; f?.contentWindow?.print(); }}
              className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm">Print</button>
            <a href={receiptUrl} download={`return-${returnNumber}.pdf`}
              className="flex-1 bg-gray-100 text-gray-700 text-center py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center">
              PDF yuklash
            </a>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-400 py-8">Chek topilmadi</p>
      )}
    </div>
  );
}

// ─── Sale/Debt Receipt Modal ──────────────────────────────────
function ReceiptModal({ type, id, number, amount }: {
  type: 'sale' | 'debt'; id: string; number: string; amount?: number;
}) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = type === 'sale'
      ? `/sales/${id}/receipt`
      : `/debts/${id}/receipt${amount ? `?amount=${amount}` : ''}`;
    let objectUrl: string | null = null;
    api.get(url, { responseType: 'blob' })
      .then((res) => {
        objectUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        setReceiptUrl(objectUrl);
      })
      .catch(() => toast.error('Chek yuklanmadi'))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) window.URL.revokeObjectURL(objectUrl); };
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
            <button onClick={() => { const iframe = document.querySelector('iframe') as HTMLIFrameElement; iframe?.contentWindow?.print(); }}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm">Print</button>
            <a href={receiptUrl} download={`chek-${number}.pdf`}
              className="flex-1 bg-gray-100 text-gray-700 text-center py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center">
              PDF yuklash
            </a>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-400 py-8">Chek topilmadi</p>
      )}
    </div>
  );
}

// ─── Return Card ──────────────────────────────────────────────
function ReturnCard({ ret, onUpdated }: { ret: any; onUpdated: () => void }) {
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/returns/${ret.id}/approve`),
    onSuccess: () => {
      toast.success('Qaytarish tasdiqlandi — stok tiklandi');
      onUpdated();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/returns/${ret.id}/reject`, { notes: rejectNote || undefined }),
    onSuccess: () => {
      toast.success('Qaytarish rad etildi');
      setShowRejectInput(false);
      onUpdated();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik'),
  });

  const statusCfg: Record<string, { label: string; cls: string; icon: any }> = {
    PENDING:  { label: 'Kutilmoqda',  cls: 'bg-amber-100 text-amber-700',  icon: Clock },
    APPROVED: { label: 'Tasdiqlandi', cls: 'bg-green-100 text-green-700',  icon: CheckCircle },
    REJECTED: { label: 'Rad etildi',  cls: 'bg-gray-100 text-gray-500',    icon: XCircle },
  };
  const sc = statusCfg[ret.status] ?? statusCfg.PENDING;
  const StatusIcon = sc.icon;

  return (
    <div className={`bg-white rounded-xl border-2 p-4 space-y-3 transition-all ${
      ret.status === 'PENDING'  ? 'border-amber-200' :
      ret.status === 'APPROVED' ? 'border-green-200' : 'border-gray-100'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">#{ret.returnNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${sc.cls}`}>
              <StatusIcon size={10} />{sc.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Asl savdo: <span className="font-semibold text-indigo-600">#{ret.originalSaleNumber}</span>
            {' · '}{format(parseISO(ret.createdAt), 'dd.MM.yyyy HH:mm')}
          </p>
          {ret.reason && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-1">
              Sabab: {ret.reason}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-purple-700 text-base">{fmtAmount(ret.refundAmount)}</p>
          <p className="text-xs text-gray-400">qaytarish</p>
        </div>
      </div>

      {/* Mahsulotlar */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
        {(ret.items || []).map((item: any) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Package size={11} className="text-gray-300 flex-shrink-0" />
              <span className="text-gray-700 truncate">{item.productName}</span>
              <span className="text-gray-400 flex-shrink-0">× {item.quantity}</span>
            </div>
            <span className="font-semibold text-gray-700 flex-shrink-0 ml-2">{fmtAmount(item.refundTotal)}</span>
          </div>
        ))}
      </div>

      {/* Chek */}
      <button onClick={() => setShowReceipt(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-purple-600 font-semibold py-2 rounded-lg hover:bg-purple-50 transition-colors border border-purple-100">
        <FileText size={12} /> Chekni ko'rish
      </button>

      {/* Tasdiqlash / Rad etish — faqat PENDING */}
      {ret.status === 'PENDING' && (
        <div className="space-y-2">
          {showRejectInput ? (
            <div className="space-y-2">
              <textarea
                value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Rad etish sababi (ixtiyoriy)..." rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowRejectInput(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  Bekor
                </button>
                <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1">
                  {rejectMutation.isPending
                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><X size={12} /> Rad etish</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowRejectInput(true)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                <X size={13} /> Rad etish
              </button>
              <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
                {approveMutation.isPending
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Check size={13} /> Tasdiqlash</>}
              </button>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)}
        title={`Qaytarish cheki #${ret.returnNumber}`} size="md">
        <ReturnReceiptModal returnId={ret.id} returnNumber={ret.returnNumber} />
      </Modal>
    </div>
  );
}

// ─── Returns Tab ──────────────────────────────────────────────
function ReturnsTab() {
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'all'>('PENDING');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['returns-list', filter],
    queryFn: async () => {
      const params: any = { page: 1, limit: 50 };
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/returns', { params });
      return data;
    },
  });

  const returns = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { k: 'PENDING',  l: 'Kutilmoqda' },
          { k: 'APPROVED', l: 'Tasdiqlangan' },
          { k: 'REJECTED', l: 'Rad etilgan' },
          { k: 'all',      l: 'Barchasi' },
        ].map(({ k, l }) => (
          <button key={k} onClick={() => setFilter(k as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === k ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      ) : returns.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <RotateCcw size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">
            {filter === 'PENDING' ? "Kutilayotgan qaytarishlar yo'q" : "Qaytarishlar topilmadi"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filter === 'PENDING' && returns.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <Clock size={15} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800 font-medium">
                {returns.length} ta qaytarish sizning tasdiqlashingizni kutmoqda
              </p>
            </div>
          )}
          {returns.map((ret: any) => (
            <ReturnCard key={ret.id} ret={ret} onUpdated={refetch} />
          ))}
        </div>
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

  const customerName  = snap.customerName || meta.customerName || snap.debtorName || meta.debtorName || null;
  const saleNumber    = snap.saleNumber   || meta.saleNumber   || null;
  const returnNumber  = snap.returnNumber ?? meta.returnNumber ?? null;
  const grandTotal    = snap.grandTotal   ?? snap.amount       ?? meta.amount    ?? null;
  const paymentAmount = snap.paymentAmount ?? meta.paymentAmount ?? null;
  const refundAmount  = snap.refundAmount  ?? meta.refundAmount  ?? null;

  const canViewReceipt = (action === 'SALE_COMPLETED' || action === 'DEBT_PAYMENT') && log.entityId;

  const handleClick = () => {
    if (!canViewReceipt) return;
    if (action === 'SALE_COMPLETED') {
      onOpen({ type: 'sale', id: log.entityId, number: saleNumber ?? log.entityId.slice(0, 8) });
    } else if (action === 'DEBT_PAYMENT') {
      onOpen({ type: 'debt', id: log.entityId, number: log.entityId.slice(0, 8), amount: paymentAmount ?? undefined });
    }
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl border ${cfg.borderColor} transition-all ${
        canViewReceipt ? 'cursor-pointer hover:shadow-md hover:border-indigo-200' : 'hover:shadow-sm'
      }`}
      onClick={handleClick}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bgColor}`}>
        <Icon size={16} className={cfg.iconColor} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{cfg.label}</span>
          {saleNumber && <span className="text-xs text-gray-400">#{saleNumber}</span>}
          {returnNumber && !saleNumber && <span className="text-xs text-gray-400">#{returnNumber}</span>}
          {customerName ? (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
              <User size={10} />{customerName}
            </span>
          ) : action === 'SALE_COMPLETED' ? (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-medium">Naqd</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-400">{log.user?.fullName || log.user?.username || "Noma'lum"}</p>
          <span className="text-gray-200">·</span>
          <p className="text-xs text-gray-400">{format(parseISO(log.createdAt), 'HH:mm')}</p>
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

      <div className="text-right flex-shrink-0">
        {action === 'DEBT_PAYMENT' && paymentAmount ? (
          <p className="font-bold text-sm text-amber-600">{fmtAmount(paymentAmount)}</p>
        ) : (action === 'RETURN_CREATED' || action === 'RETURN_APPROVED') && refundAmount ? (
          <p className="font-bold text-sm text-purple-600">-{fmtAmount(refundAmount)}</p>
        ) : grandTotal ? (
          <p className="font-bold text-sm text-gray-900">{fmtAmount(grandTotal)}</p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export function AuditLogsPage() {
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage]           = useState(1);
  const [receipt, setReceipt]     = useState<{
    type: 'sale' | 'debt'; id: string; number: string; amount?: number;
  } | null>(null);

  // Kutilayotgan qaytarishlar soni — badge uchun
  const { data: pendingData } = useQuery({
    queryKey: ['returns-pending-count'],
    queryFn: () => api.get('/returns', { params: { status: 'PENDING', limit: 1 } }).then(r => r.data),
    refetchInterval: 30000,
  });
  const pendingCount: number = pendingData?.total ?? 0;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, activeTab],
    queryFn: () => auditApi.getAll({
      page, limit: 50,
      search: search || undefined,
      action: activeTab !== 'all' && activeTab !== 'SALE_RETURNED' ? activeTab : undefined,
    }),
    enabled: activeTab !== 'SALE_RETURNED',
  });

  const logs: any[]   = data?.data  ?? [];
  const total: number = data?.total ?? 0;

  const filtered = activeTab === 'all'
    ? logs.filter(l => ACTION_CONFIG[l.action] !== undefined)
    : logs;

  const grouped = groupByDate(filtered);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sotuv Jurnali</h1>
        <p className="text-gray-500 text-sm">
          {activeTab === 'SALE_RETURNED' ? 'Qaytarishlar boshqaruvi' : `${total} ta yozuv`}
        </p>
      </div>

      {activeTab !== 'SALE_RETURNED' && (
        <Input
          placeholder="Qidirish..."
          icon={<Search size={16} />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setPage(1); }}
            className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === key
                ? key === 'SALE_RETURNED' ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
            }`}
          >
            {label}
            {key === 'SALE_RETURNED' && pendingCount > 0 && activeTab !== 'SALE_RETURNED' && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'SALE_RETURNED' ? (
        <ReturnsTab />
      ) : isLoading ? (
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
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.label}</span>
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
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-indigo-300 transition-colors">
                Oldingi
              </button>
              <span className="text-sm text-gray-500">{page} / {Math.ceil(total / 50)}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 50)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-indigo-300 transition-colors">
                Keyingi
              </button>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={!!receipt}
        onClose={() => setReceipt(null)}
        title={receipt?.type === 'debt' ? "Qarz to'lov cheki" : `Sotuv cheki #${receipt?.number ?? ''}`}
        size="md"
      >
        {receipt && <ReceiptModal type={receipt.type} id={receipt.id} number={receipt.number} amount={receipt.amount} />}
      </Modal>
    </div>
  );
}