// src/pages/AuditLogsPage.tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/lib/axios';
import { Input } from '../shared/ui/Input';
import { Modal } from '../shared/ui/Modal';
import { toast } from '../shared/ui/Toast';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { uz } from 'date-fns/locale';
import {
  Search, ShoppingBag, RotateCcw, User, Package,
  AlertTriangle, FileText, TrendingDown, Settings, LogIn,
  Check, X, Clock, CheckCircle, XCircle, CreditCard,
  Banknote, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// ACTION CONFIG — barcha AuditAction lar
// ─────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, {
  label: string; icon: any; iconColor: string;
  bgColor: string; borderColor: string;
}> = {
  // Sotuvlar
  SALE_COMPLETED:     { label: 'Sotuv',               icon: ShoppingBag, iconColor: 'text-indigo-600',  bgColor: 'bg-indigo-50',   borderColor: 'border-indigo-100'  },
  SALE_CREATED:       { label: 'Sotuv (draft)',        icon: ShoppingBag, iconColor: 'text-indigo-300',  bgColor: 'bg-indigo-50',   borderColor: 'border-indigo-100'  },
  SALE_CANCELLED:     { label: 'Sotuv bekor',          icon: ShoppingBag, iconColor: 'text-red-400',     bgColor: 'bg-red-50',      borderColor: 'border-red-100'     },
  PRICE_OVERRIDE:     { label: "Narx o'zgardi",        icon: ShoppingBag, iconColor: 'text-orange-500',  bgColor: 'bg-orange-50',   borderColor: 'border-orange-100'  },
  DISCOUNT_APPLIED:   { label: 'Chegirma',             icon: ShoppingBag, iconColor: 'text-indigo-500',  bgColor: 'bg-indigo-50',   borderColor: 'border-indigo-100'  },
  // Qaytarishlar
  RETURN_CREATED:     { label: 'Qaytarish so\'rovi',   icon: RotateCcw,   iconColor: 'text-amber-500',   bgColor: 'bg-amber-50',    borderColor: 'border-amber-100'   },
  RETURN_APPROVED:    { label: 'Qaytarish tasdiqlandi',icon: RotateCcw,   iconColor: 'text-green-600',   bgColor: 'bg-green-50',    borderColor: 'border-green-100'   },
  RETURN_REJECTED:    { label: 'Qaytarish rad etildi', icon: RotateCcw,   iconColor: 'text-red-400',     bgColor: 'bg-red-50',      borderColor: 'border-red-100'     },
  // To'lovlar
  PAYMENT_RECORDED:   { label: "To'lov",               icon: Banknote,    iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-100' },
  DEBT_PAYMENT:       { label: "Qarz to'lovi",         icon: CreditCard,  iconColor: 'text-amber-600',   bgColor: 'bg-amber-50',    borderColor: 'border-amber-100'   },
  DEBT_CANCELLED:     { label: 'Qarz bekor',            icon: AlertTriangle, iconColor: 'text-red-500',   bgColor: 'bg-red-50',      borderColor: 'border-red-100'     },
  // Inventar
  INVENTORY_ADJUSTED: { label: "Stok o'zgardi",        icon: Package,     iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-100' },
  STOCK_DECREASED:    { label: 'Stok kamaydi',          icon: TrendingDown,iconColor: 'text-orange-500',  bgColor: 'bg-orange-50',   borderColor: 'border-orange-100'  },
  STOCK_INCREASED:    { label: "Stok ko'paydi",         icon: Package,     iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-100' },
  // Tizim
  LOGIN:              { label: 'Kirish',                icon: LogIn,       iconColor: 'text-gray-500',    bgColor: 'bg-gray-50',     borderColor: 'border-gray-100'    },
  LOGOUT:             { label: 'Chiqish',               icon: LogIn,       iconColor: 'text-gray-400',    bgColor: 'bg-gray-50',     borderColor: 'border-gray-100'    },
  PASSWORD_CHANGED:   { label: "Parol o'zgardi",        icon: Settings,    iconColor: 'text-gray-500',    bgColor: 'bg-gray-50',     borderColor: 'border-gray-100'    },
  TOKEN_REFRESHED:    { label: 'Token yangilandi',      icon: Settings,    iconColor: 'text-gray-300',    bgColor: 'bg-gray-50',     borderColor: 'border-gray-100'    },
  CREATED:            { label: "Qo'shildi",             icon: Settings,    iconColor: 'text-blue-500',    bgColor: 'bg-blue-50',     borderColor: 'border-blue-100'    },
  UPDATED:            { label: 'Yangilandi',            icon: Settings,    iconColor: 'text-gray-500',    bgColor: 'bg-gray-50',     borderColor: 'border-gray-100'    },
  DELETED:            { label: "O'chirildi",            icon: Settings,    iconColor: 'text-red-400',     bgColor: 'bg-red-50',      borderColor: 'border-red-100'     },
  RESTORED:           { label: 'Tiklandi',              icon: Settings,    iconColor: 'text-green-500',   bgColor: 'bg-green-50',    borderColor: 'border-green-100'   },
  USER_CREATED:       { label: 'Foydalanuvchi qo\'shildi', icon: User,    iconColor: 'text-blue-500',    bgColor: 'bg-blue-50',     borderColor: 'border-blue-100'    },
};

const DEFAULT_CFG = {
  label: 'Amal', icon: Settings,
  iconColor: 'text-gray-400', bgColor: 'bg-gray-50', borderColor: 'border-gray-100',
};

// Tab lari va ularga mos action filterlari
const TABS = [
  { key: 'all',            label: 'Barchasi',     actions: null },
  { key: 'sales',          label: 'Sotuvlar',     actions: 'SALE_COMPLETED,SALE_CANCELLED,PRICE_OVERRIDE,DISCOUNT_APPLIED' },
  { key: 'payments',       label: "To'lovlar",    actions: 'DEBT_PAYMENT,PAYMENT_RECORDED' },
  { key: 'returns',        label: 'Qaytarishlar', actions: null }, // alohida tab
  { key: 'system',         label: 'Tizim',        actions: 'LOGIN,LOGOUT,PASSWORD_CHANGED,CREATED,UPDATED,DELETED,USER_CREATED' },
];

// ─────────────────────────────────────────────────────────────
function fmtMoney(v: number | null | undefined) {
  if (v == null) return null;
  return '$' + Number(v).toLocaleString('uz-UZ', { maximumFractionDigits: 2 });
}

function groupByDate(logs: any[]) {
  const groups = new Map<string, any[]>();
  for (const log of logs) {
    const d = (log.createdAt ?? '').slice(0, 10);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(log);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => {
      const d = parseISO(date);
      let label = format(d, 'dd MMMM yyyy', { locale: uz });
      if (isToday(d))     label = 'Bugun';
      else if (isYesterday(d)) label = 'Kecha';
      return { label, date, items };
    });
}

// ─────────────────────────────────────────────────────────────
// RETURN RECEIPT MODAL
// ─────────────────────────────────────────────────────────────
function ReturnReceiptModal({ returnId, returnNumber }: { returnId: string; returnNumber: string }) {
  const [url, setUrl]         = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    api.get(`/returns/${returnId}/receipt`, { responseType: 'blob' })
      .then(res => {
        objectUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        setUrl(objectUrl);
      })
      .catch(() => toast.error('Chek yuklanmadi'))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [returnId]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>;
  if (!url)    return <p className="text-center text-gray-400 py-8">Chek topilmadi</p>;

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: '60vh' }}>
        <iframe src={url} className="w-full h-full" title={`Qaytarish #${returnNumber}`} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => (document.querySelector('iframe') as HTMLIFrameElement)?.contentWindow?.print()}
          className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-semibold text-sm">
          Chop etish
        </button>
        <a href={url} download={`return-${returnNumber}.pdf`}
          className="flex-1 bg-gray-100 text-gray-700 text-center py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center">
          PDF yuklash
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SALE / DEBT RECEIPT MODAL
// ─────────────────────────────────────────────────────────────
function ReceiptModal({ type, id, number }: { type: 'sale' | 'debt'; id: string; number: string }) {
  const [url, setUrl]         = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = type === 'sale' ? `/sales/${id}/receipt` : `/debts/${id}/receipt`;
    let objectUrl: string | null = null;
    api.get(path, { responseType: 'blob' })
      .then(res => {
        objectUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        setUrl(objectUrl);
      })
      .catch(() => toast.error('Chek yuklanmadi'))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, type]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (!url)    return <p className="text-center text-gray-400 py-8">Chek topilmadi</p>;

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: '60vh' }}>
        <iframe src={url} className="w-full h-full" title={`Chek #${number}`} />
      </div>
      <div className="flex gap-2">
        <button onClick={() => (document.querySelector('iframe') as HTMLIFrameElement)?.contentWindow?.print()}
          className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm">
          Chop etish
        </button>
        <a href={url} download={`chek-${number}.pdf`}
          className="flex-1 bg-gray-100 text-gray-700 text-center py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center">
          PDF yuklash
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RETURN CARD
// ─────────────────────────────────────────────────────────────
function ReturnCard({ ret, onUpdated }: { ret: any; onUpdated: () => void }) {
  const [rejectNote,      setRejectNote]      = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showReceipt,     setShowReceipt]     = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/returns/${ret.id}/approve`),
    onSuccess:  () => { toast.success('Qaytarish tasdiqlandi — stok tiklandi'); onUpdated(); },
    onError:    (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/returns/${ret.id}/reject`, { reason: rejectNote || 'Rad etildi' }),
    onSuccess:  () => { toast.success('Qaytarish rad etildi'); setShowRejectInput(false); onUpdated(); },
    onError:    (e: any) => toast.error(e?.response?.data?.message ?? 'Xatolik'),
  });

  const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
    PENDING:  { label: 'Kutilmoqda',  cls: 'bg-amber-100 text-amber-700', icon: Clock        },
    APPROVED: { label: 'Tasdiqlandi', cls: 'bg-green-100 text-green-700', icon: CheckCircle  },
    REJECTED: { label: 'Rad etildi',  cls: 'bg-gray-100  text-gray-500',  icon: XCircle      },
  };
  const sc = STATUS_CFG[ret.status] ?? STATUS_CFG.PENDING;
  const StatusIcon = sc.icon;

  const borderCls =
    ret.status === 'PENDING'  ? 'border-amber-200 bg-amber-50/20' :
    ret.status === 'APPROVED' ? 'border-green-200 bg-green-50/10' :
                                'border-gray-200  bg-white';

  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 transition-all ${borderCls}`}>
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
            Asl savdo:{' '}
            <span className="font-semibold text-indigo-600">
              #{ret.originalSaleNumber ?? ret.originalSale?.saleNumber ?? '—'}
            </span>
            {' · '}{ret.createdAt ? format(parseISO(ret.createdAt), 'dd.MM.yyyy HH:mm') : ''}
          </p>
          {ret.reason && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-1">
              Sabab: {ret.reason}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-purple-700 text-base">{fmtMoney(ret.refundAmount)}</p>
          <p className="text-xs text-gray-400">qaytarish</p>
        </div>
      </div>

      {/* Mahsulotlar */}
      {(ret.items ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-1.5">
          {ret.items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Package size={11} className="text-gray-300 flex-shrink-0" />
                <span className="text-gray-700 truncate">{item.productName}</span>
                <span className="text-gray-400 flex-shrink-0">
                  × {item.quantity} {item.unit ?? 'dona'}
                </span>
              </div>
              <span className="font-semibold text-gray-700 flex-shrink-0 ml-2">
                {fmtMoney(item.refundTotal)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Chek tugmasi */}
      <button onClick={() => setShowReceipt(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-purple-600 font-semibold py-2 rounded-lg hover:bg-purple-50 transition-colors border border-purple-100">
        <FileText size={12} /> Chekni ko'rish
      </button>

      {/* PENDING — tasdiqlash / rad etish */}
      {ret.status === 'PENDING' && (
        <div className="space-y-2">
          {showRejectInput ? (
            <div className="space-y-2">
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                placeholder="Rad etish sababi (ixtiyoriy)..." rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowRejectInput(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  Bekor
                </button>
                <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-1 transition-colors">
                  {rejectMutation.isPending
                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><X size={12} />Rad etish</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowRejectInput(true)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 transition-colors">
                <X size={13} /> Rad etish
              </button>
              <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-1.5 transition-colors">
                {approveMutation.isPending
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Check size={13} />Tasdiqlash</>}
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

// ─────────────────────────────────────────────────────────────
// RETURNS TAB — filter yo'q, hammasi bitta ro'yxatda
// ─────────────────────────────────────────────────────────────
function ReturnsTab() {
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['returns-all'],
    queryFn:  () => api.get('/returns', { params: { page: 1, limit: 100 } }).then(r => r.data),
    refetchInterval: 30_000,
  });

  const all:     any[] = data?.data ?? [];
  const pending  = all.filter((r: any) => r.status === 'PENDING');
  const approved = all.filter((r: any) => r.status === 'APPROVED');
  const rejected = all.filter((r: any) => r.status === 'REJECTED');

  const handleUpdated = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ['returns-pending-count'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <RotateCcw size={40} className="mx-auto mb-2 opacity-20" />
        <p className="text-sm">Hali qaytarishlar yo'q</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Kutilayotganlar */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <Clock size={15} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800 font-semibold">
              {pending.length} ta qaytarish tasdiqlashingizni kutmoqda
            </p>
          </div>
          {pending.map((r: any) => (
            <ReturnCard key={r.id} ret={r} onUpdated={handleUpdated} />
          ))}
        </div>
      )}

      {/* Tasdiqlangan */}
      {approved.length > 0 && (
        <div className="space-y-3">
          {pending.length > 0 && <div className="h-px bg-gray-200" />}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <CheckCircle size={12} className="text-green-500" /> Tasdiqlangan ({approved.length})
          </p>
          {approved.map((r: any) => (
            <ReturnCard key={r.id} ret={r} onUpdated={handleUpdated} />
          ))}
        </div>
      )}

      {/* Rad etilgan */}
      {rejected.length > 0 && (
        <div className="space-y-3">
          {(pending.length > 0 || approved.length > 0) && <div className="h-px bg-gray-200" />}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <XCircle size={12} className="text-gray-400" /> Rad etilgan ({rejected.length})
          </p>
          {rejected.map((r: any) => (
            <ReturnCard key={r.id} ret={r} onUpdated={handleUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOG ROW
// ─────────────────────────────────────────────────────────────
function LogRow({ log, onOpen }: {
  log: any;
  onOpen: (info: { type: 'sale' | 'debt'; id: string; number: string }) => void;
}) {
  const cfg      = ACTION_CONFIG[log.action] ?? DEFAULT_CFG;
  const Icon     = cfg.icon;
  const snap     = log.afterSnapshot ?? {};
  const meta     = log.metadata      ?? {};

  const customerName   = snap.customerName  ?? meta.customerName  ?? snap.debtorName ?? meta.debtorName ?? null;
  const saleNumber     = snap.saleNumber    ?? meta.saleNumber    ?? null;
  const returnNumber   = snap.returnNumber  ?? meta.returnNumber  ?? null;
  const grandTotal     = snap.grandTotal    ?? meta.grandTotal    ?? snap.amount ?? meta.amount ?? null;
  const paymentAmount  = snap.paymentAmount ?? meta.paymentAmount ?? snap.paidAmount ?? meta.paidAmount ?? null;
  const refundAmount   = snap.refundAmount  ?? meta.refundAmount  ?? null;

  const canView =
    (log.action === 'SALE_COMPLETED' || log.action === 'DEBT_PAYMENT') &&
    log.entityId;

  const handleClick = () => {
    if (!canView) return;
    onOpen({
      type:   log.action === 'SALE_COMPLETED' ? 'sale' : 'debt',
      id:     log.entityId,
      number: saleNumber ?? log.entityId.slice(0, 8),
    });
  };

  const displayAmount =
    log.action === 'DEBT_PAYMENT'  ? paymentAmount :
    log.action === 'RETURN_CREATED' || log.action === 'RETURN_APPROVED' ? refundAmount :
    grandTotal;

  const amountColor =
    log.action === 'DEBT_PAYMENT'   ? 'text-amber-600'  :
    log.action?.includes('RETURN')  ? 'text-purple-600' :
    log.action === 'SALE_CANCELLED' ? 'text-red-500'    :
    'text-gray-900';

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl border ${cfg.borderColor} transition-all ${
        canView ? 'cursor-pointer hover:shadow-md hover:border-indigo-200' : 'hover:shadow-sm'
      }`}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bgColor}`}>
        <Icon size={16} className={cfg.iconColor} />
      </div>

      {/* Matn */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{cfg.label}</span>
          {saleNumber   && <span className="text-xs text-gray-400">#{saleNumber}</span>}
          {returnNumber && !saleNumber && <span className="text-xs text-gray-400">#{returnNumber}</span>}
          {customerName ? (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
              <User size={10} />{customerName}
            </span>
          ) : log.action === 'SALE_COMPLETED' ? (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">Naqd</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">
            {log.user?.fullName || log.user?.username || "Noma'lum"}
          </span>
          <span className="text-gray-200">·</span>
          <span className="text-xs text-gray-400">
            {log.createdAt ? format(parseISO(log.createdAt), 'HH:mm') : ''}
          </span>
          {canView && (
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
      {displayAmount != null && (
        <div className="text-right flex-shrink-0">
          <p className={`font-bold text-sm ${amountColor}`}>
            {log.action === 'RETURN_CREATED' || log.action === 'RETURN_APPROVED'
              ? `-${fmtMoney(displayAmount)}`
              : fmtMoney(displayAmount)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export function AuditLogsPage() {
  const [search,    setSearch]    = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [page,      setPage]      = useState(1);
  const [receipt,   setReceipt]   = useState<{
    type: 'sale' | 'debt'; id: string; number: string;
  } | null>(null);

  // Kutilayotgan qaytarishlar soni (badge uchun)
  const { data: pendingData } = useQuery({
    queryKey: ['returns-pending-count'],
    queryFn:  () => api.get('/returns', { params: { status: 'PENDING', limit: 1 } }).then(r => r.data),
    refetchInterval: 30_000,
  });
  const pendingCount: number = pendingData?.total ?? 0;

  const currentTab = TABS.find(t => t.key === activeTab);
  const isReturns  = activeTab === 'returns';

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, activeTab],
    queryFn:  () => api.get('/audit-logs', {
      params: {
        page,
        limit:  50,
        action: currentTab?.actions ?? undefined,
        search: search || undefined,
      },
    }).then(r => r.data),
    enabled: !isReturns,
  });

  const logs:  any[]  = data?.data  ?? [];
  const total: number = data?.total ?? 0;
  const grouped = groupByDate(logs);

  return (
    <div className="space-y-4">
      {/* Sarlavha */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sotuv Jurnali</h1>
        <p className="text-gray-500 text-sm">
          {isReturns ? 'Qaytarishlar boshqaruvi' : `${total} ta yozuv`}
        </p>
      </div>

      {/* Qidiruv — qaytarishlar tabida ko'rinmaydi */}
      {!isReturns && (
        <Input
          placeholder="Savdo raqami, mijoz nomi bo'yicha qidirish..."
          icon={<Search size={16} />}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      )}

      {/* Tablar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setPage(1); setSearch(''); }}
            className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === key
                ? key === 'returns'
                  ? 'bg-purple-600 text-white'
                  : 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
            }`}
          >
            {label}
            {/* Kutilayotgan qaytarishlar badge */}
            {key === 'returns' && pendingCount > 0 && activeTab !== 'returns' && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white
                               text-xs rounded-full flex items-center justify-center font-bold">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Kontent */}
      {isReturns ? (
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
          {grouped.map(group => (
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

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-indigo-300 transition-colors"
              >
                <ChevronLeft size={15} /> Oldingi
              </button>
              <span className="text-sm text-gray-500">
                {page} / {Math.ceil(total / 50)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 50)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl disabled:opacity-40 hover:border-indigo-300 transition-colors"
              >
                Keyingi <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Chek modal */}
      <Modal
        isOpen={!!receipt}
        onClose={() => setReceipt(null)}
        title={receipt?.type === 'debt'
          ? "Qarz to'lov cheki"
          : `Sotuv cheki #${receipt?.number ?? ''}`}
        size="md"
      >
        {receipt && (
          <ReceiptModal
            type={receipt.type}
            id={receipt.id}
            number={receipt.number}
          />
        )}
      </Modal>
    </div>
  );
}