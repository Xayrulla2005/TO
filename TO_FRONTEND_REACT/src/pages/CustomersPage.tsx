import { useState, useMemo, useEffect } from "react";
// totalDebt endi customer.totalDebt dan keladi — /debts?limit=1000 kerak emas
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  customersApi,
  Customer,
  Sale,
} from "../features/customer/api/customers.api";
import { api } from "../shared/lib/axios";
import { formatCurrency } from "../shared/lib/utils";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { uz } from "date-fns/locale";
import { toast } from "../shared/ui/Toast";
import { Modal } from "../shared/ui/Modal";
import { Input } from "../shared/ui/Input";
import { Button } from "../shared/ui/Button";
import {
  Search,
  User,
  Phone,
  ChevronRight,
  Plus,
  Edit2,
  Banknote,
  CreditCard,
  AlertCircle,
  BarChart2,
  ShoppingBag,
  Trash2,
  Package,
  ArrowLeft,
  FileText,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Users,
  AlertTriangle,
  DollarSign,
  Calendar,
} from "lucide-react";

const fmt = (v: number | string | null | undefined) => `$${formatCurrency(v)}`;

function groupSalesByDate(sales: Sale[]): { label: string; date: string; sales: Sale[] }[] {
  const groups = new Map<string, Sale[]>();
  for (const sale of sales) {
    const dateStr = sale.completedAt ? sale.completedAt.slice(0, 10) : sale.createdAt.slice(0, 10);
    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr)!.push(sale);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, sales]) => {
      const d = parseISO(date);
      let label = format(d, "dd MMMM yyyy", { locale: uz });
      if (isToday(d)) label = "Bugun";
      else if (isYesterday(d)) label = "Kecha";
      return { label, date, sales };
    });
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    PENDING: { cls: "bg-red-100 text-red-700", label: "To'lanmagan" },
    PARTIALLY_PAID: { cls: "bg-amber-100 text-amber-700", label: "Qisman" },
    PAID: { cls: "bg-emerald-100 text-emerald-700", label: "To'langan" },
    CANCELLED: { cls: "bg-gray-100 text-gray-500", label: "Bekor" },
  };
  const c = cfg[status] ?? { cls: "bg-gray-100 text-gray-500", label: status };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.cls}`}>
      {c.label}
    </span>
  );
}

// ── Customer Form Modal ──────────────────────────────────────
function CustomerFormModal({
  customer,
  onClose,
}: {
  customer?: Customer | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      customer
        ? customersApi.update(customer.id, { name, phone, notes: notes || undefined })
        : customersApi.create({ name, phone, notes: notes || undefined }),
    onSuccess: () => {
      toast.success(customer ? "Mijoz yangilandi" : "Mijoz qo'shildi");
      qc.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Xatolik"),
  });

  return (
    <div className="space-y-4">
      <Input
        label="To'liq ism *"
        value={name}
        onChange={(e) => setName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
        placeholder="Mijoz ismi"
      />
      <Input
        label="Telefon raqami *"
        value={phone}
        onChange={(e) => {
          let val = e.target.value.replace(/\D/g, "");
          if (val.length === 0) { setPhone("+998 "); return; }
          if (!val.startsWith("998")) val = "998" + val;
          if (val.length > 12) val = val.slice(0, 12);
          const d = val.slice(3);
          let f = "+998";
          if (d.length > 0) f += " " + d.slice(0, 2);
          if (d.length > 2) f += " " + d.slice(2, 5);
          if (d.length > 5) f += " " + d.slice(5, 7);
          if (d.length > 7) f += " " + d.slice(7, 9);
          setPhone(f);
        }}
        onFocus={() => { if (!phone) setPhone("+998 "); }}
        placeholder="+998 90 123 45 67"
        type="tel"
      />
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Izoh</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Qo'shimcha ma'lumot..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Bekor</Button>
        <Button className="flex-1" isLoading={mutation.isPending} onClick={() => {
          if (!name.trim()) { toast.error("Ism kiriting"); return; }
          if (!phone.trim()) { toast.error("Telefon kiriting"); return; }
          mutation.mutate();
        }}>
          {customer ? "Saqlash" : "Qo'shish"}
        </Button>
      </div>
    </div>
  );
}

// ── Pay Debt Modal ───────────────────────────────────────────
function PayDebtModal({ debtId, remaining, onClose }: {
  debtId: string;
  remaining: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<"CASH" | "CARD">("CASH");
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);

  const downloadReceipt = async (id: string) => {
    setLoadingReceipt(true);
    try {
      const res = await api.get(`/debts/${id}/receipt`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      setReceiptUrl(url);
    } catch {
      toast.error("Chek yuklanmadi");
    } finally {
      setLoadingReceipt(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/debts/${debtId}/payment`, {
        amount: Number(amount),
        paymentMethod: method,
        notes: note || undefined,
      }),
    onSuccess: () => {
      toast.success("To'lov amalga oshirildi!");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-sales"] });
      qc.invalidateQueries({ queryKey: ["customer-stats"] });
      setPaidAmount(Number(amount));
      setPaid(true);
      downloadReceipt(debtId);
    },
    onError: () => toast.error("Xatolik yuz berdi"),
  });

  // ── To'lovdan keyin: chek ko'rinishi ──
  if (paid) {
    return (
      <div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Banknote size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-emerald-800 text-sm">To'lov muvaffaqiyatli!</p>
            <p className="text-xs text-emerald-600">${paidAmount.toLocaleString('uz-UZ')} to'landi</p>
          </div>
        </div>
        {loadingReceipt ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : receiptUrl ? (
          <>
            <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: "50vh" }}>
              <iframe src={receiptUrl} className="w-full h-full" title="Qarz to'lov cheki" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { const f = document.querySelector("iframe") as HTMLIFrameElement; f?.contentWindow?.print(); }}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm"
              >Print</button>
              <a
                href={receiptUrl}
                download={`qarz-chek-${debtId.slice(0,8)}.pdf`}
                className="flex-1 bg-gray-100 text-gray-700 text-center py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center"
              >PDF yuklash</a>
            </div>
          </>
        ) : null}
        <button onClick={onClose} className="w-full py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
          Yopish
        </button>
      </div>
    );
  }

  // ── To'lov formasi ──
  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={16} className="text-red-500" />
          <p className="text-sm font-semibold text-red-700">Qarz summasi</p>
        </div>
        <p className="text-2xl font-bold text-red-600">{fmt(remaining)}</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To'lov summasi</label>
        <input
          type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
          max={remaining} min={1}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 font-semibold text-lg"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To'lov usuli</label>
        <div className="flex gap-2">
          {(["CASH", "CARD"] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${method === m ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {m === "CASH" ? <><Banknote size={15} />Naqd</> : <><CreditCard size={15} />Karta</>}
            </button>
          ))}
        </div>
      </div>
      <Input label="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Izoh..." />
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Bekor</Button>
        <Button className="flex-1" isLoading={mutation.isPending}
          onClick={() => {
            if (!amount || Number(amount) <= 0) { toast.error("Summa kiriting"); return; }
            if (Number(amount) > remaining) { toast.error("Summa qarzdan oshib ketdi"); return; }
            mutation.mutate();
          }}>
          To'lash
        </Button>
      </div>
    </div>
  );
}

// ── Sale Receipt Modal ───────────────────────────────────────
// BUG FIX: useState(() => async) → useEffect ishlatildi
function SaleReceiptModal({ saleId, saleNumber }: {
  saleId: string;
  saleNumber: string;
  onClose: () => void;
}) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    api
      .get(`/sales/${saleId}/receipt`, { responseType: "blob" })
      .then((res) => {
        objectUrl = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        setReceiptUrl(objectUrl);
      })
      .catch(() => toast.error("Chek yuklanmadi"))
      .finally(() => setLoading(false));

    // Cleanup: memory leak oldini olish
    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [saleId]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : receiptUrl ? (
        <>
          <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: "60vh" }}>
            <iframe src={receiptUrl} className="w-full h-full" title={`Chek #${saleNumber}`} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { const iframe = document.querySelector("iframe") as HTMLIFrameElement; iframe?.contentWindow?.print(); }}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm"
            >
              Print
            </button>
            <a
              href={receiptUrl}
              download={`chek-${saleNumber}.pdf`}
              className="flex-1 bg-gray-100 text-gray-700 text-center py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center"
            >
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

// ── Sale Card ────────────────────────────────────────────────
function SaleCard({ sale, onPayDebt, onViewReceipt }: {
  sale: Sale;
  onPayDebt: (debtId: string, remaining: number) => void;
  onViewReceipt: (saleId: string, saleNumber: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDebt = sale.debt && sale.debt.remainingAmount > 0;
  const isDebtSale = sale.payments?.some(p => p.method === "DEBT");

  return (
    <div className={`rounded-xl overflow-hidden border-2 transition-all ${
      hasDebt
        ? "border-red-200 bg-red-50/30"
        : isDebtSale && sale.debt?.status === "PAID"
        ? "border-emerald-200 bg-emerald-50/20"
        : "border-gray-100 bg-white"
    }`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          hasDebt ? "bg-red-100" : "bg-indigo-50"
        }`}>
          <ShoppingBag size={16} className={hasDebt ? "text-red-500" : "text-indigo-500"} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm">#{sale.saleNumber}</p>
            {hasDebt && (
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-semibold">Nasiya</span>
            )}
            {isDebtSale && sale.debt?.status === "PAID" && (
              <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-md font-semibold">To'landi</span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {sale.completedAt ? format(parseISO(sale.completedAt), "HH:mm") : "—"}
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="font-bold text-sm text-gray-900">{fmt(sale.grandTotal)}</p>
          {hasDebt && (
            <p className="text-xs text-red-500 font-semibold">{fmt(sale.debt!.remainingAmount)} qarz</p>
          )}
        </div>

        {expanded ? <ChevronUp size={15} className="text-gray-300 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-300 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-white/80">
          <div className="space-y-1.5">
            {sale.items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Package size={12} className="text-gray-300 flex-shrink-0" />
                  <span className="text-gray-700 truncate text-xs">{item.productNameSnapshot}</span>
                  <span className="text-gray-400 text-xs flex-shrink-0">× {item.quantity} {item.unitSnapshot}</span>
                </div>
                <span className="font-semibold text-gray-900 text-xs flex-shrink-0 ml-2">{fmt(item.customTotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {sale.payments.map((p: any) => (
              <span key={p.id} className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
                p.method === "CASH" ? "bg-emerald-100 text-emerald-700"
                : p.method === "CARD" ? "bg-blue-100 text-blue-700"
                : "bg-red-100 text-red-700"
              }`}>
                {p.method === "CASH" ? <Banknote size={11} /> : p.method === "CARD" ? <CreditCard size={11} /> : <AlertCircle size={11} />}
                {p.method === "CASH" ? "Naqd" : p.method === "CARD" ? "Karta" : "Nasiya"}: {fmt(p.amount)}
              </span>
            ))}
          </div>

          {sale.debt && (sale.debt.status === "PENDING" || sale.debt.status === "PARTIALLY_PAID") && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-red-700">Qarz: {fmt(sale.debt.remainingAmount)}</p>
                <StatusBadge status={sale.debt.status} />
              </div>
              <button
                onClick={() => onPayDebt(sale.debt!.id, sale.debt!.remainingAmount)}
                className="bg-emerald-600 text-white text-xs px-3 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
              >
                To'lash
              </button>
            </div>
          )}

          <button
            onClick={() => onViewReceipt(sale.id, sale.saleNumber)}
            className="w-full flex items-center justify-center gap-2 text-xs text-indigo-600 font-semibold py-2 rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-100"
          >
            <FileText size={13} /> Chekni ko'rish
          </button>
        </div>
      )}
    </div>
  );
}

// ── Customer Detail ──────────────────────────────────────────
function CustomerDetail({ customer, onBack, onEdit, onDelete }: {
  customer: Customer;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<"sales" | "stats">("sales");
  const [payingDebt, setPayingDebt] = useState<{ id: string; remaining: number } | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<{ id: string; number: string } | null>(null);
  const [salesPage, setSalesPage] = useState(1);

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["customer-sales", customer.id, salesPage],
    queryFn: () => customersApi.getSales(customer.id, salesPage),
    enabled: tab === "sales",
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["customer-stats", customer.id],
    queryFn: () => customersApi.getStats(customer.id),
  });

  const MONTHS = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];
  const grouped = useMemo(() => groupSalesByDate((salesData?.data as Sale[]) ?? []), [salesData]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-lg truncate">{customer.name}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Phone size={12} />{customer.phone}
          </p>
        </div>
        <button onClick={onEdit} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <Edit2 size={18} className="text-gray-500" />
        </button>
        <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-xl transition-colors">
          <Trash2 size={18} className="text-red-400" />
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-xs text-indigo-400 font-medium">Savdolar</p>
            <p className="font-bold text-indigo-800 text-xl">{stats.totalSales}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-400 font-medium">Jami</p>
            <p className="font-bold text-emerald-800 text-sm">{fmt(stats.totalAmount)}</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${stats.totalDebt > 0 ? "bg-red-50" : "bg-gray-50"}`}>
            <p className={`text-xs font-medium ${stats.totalDebt > 0 ? "text-red-400" : "text-gray-400"}`}>Qarz</p>
            <p className={`font-bold text-sm ${stats.totalDebt > 0 ? "text-red-700" : "text-gray-500"}`}>{fmt(stats.totalDebt)}</p>
          </div>
        </div>
      )}

      {customer.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
          <span className="font-semibold">Izoh: </span>{customer.notes}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {[
          { k: "sales", label: "Savdolar", icon: ShoppingBag },
          { k: "stats", label: "Statistika", icon: BarChart2 },
        ].map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === k ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* SALES TAB */}
      {tab === "sales" && (
        <div className="space-y-4">
          {salesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ShoppingBag size={36} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Savdo tarixi yo'q</p>
            </div>
          ) : (
            <>
              {grouped.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={13} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.label}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">{group.sales.length} ta</span>
                  </div>
                  <div className="space-y-2">
                    {group.sales.map((sale) => (
                      <SaleCard
                        key={sale.id}
                        sale={sale}
                        onPayDebt={(id, remaining) => setPayingDebt({ id, remaining })}
                        onViewReceipt={(id, number) => setViewingReceipt({ id, number })}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {(salesData?.total ?? 0) > 20 && (
                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={() => setSalesPage((p) => Math.max(1, p - 1))} disabled={salesPage === 1}>
                    Oldingi
                  </Button>
                  <span className="text-sm text-gray-500">{salesPage} / {Math.ceil((salesData?.total ?? 0) / 20)}</span>
                  <Button variant="outline" size="sm" onClick={() => setSalesPage((p) => p + 1)} disabled={salesPage >= Math.ceil((salesData?.total ?? 0) / 20)}>
                    Keyingi
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* STATS TAB */}
      {tab === "stats" && (
        <div className="space-y-3">
          {statsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-gray-100 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">O'rtacha buyurtma</p>
                  <p className="font-bold text-gray-900">{fmt(stats.averageOrderValue)}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Ro'yxatga olingan</p>
                  <p className="font-bold text-gray-900">{format(parseISO(customer.createdAt), "dd.MM.yyyy")}</p>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-500" /> Oylik statistika
                </p>
                {Object.keys(stats.monthlyStats).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Ma'lumot yo'q</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {Object.entries(stats.monthlyStats)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .slice(0, 12)
                      .map(([key, val]) => {
                        const [year, month] = key.split("-");
                        const monthName = MONTHS[parseInt(month) - 1];
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-16 flex-shrink-0">{monthName} {year}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-indigo-500 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, (val.amount / (stats.totalAmount || 1)) * 100 * 3)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-700 w-20 text-right flex-shrink-0">{fmt(val.amount)}</span>
                            <span className="text-xs text-gray-400 w-8 flex-shrink-0">{val.count}ta</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Pay Debt Modal */}
      <Modal isOpen={!!payingDebt} onClose={() => setPayingDebt(null)} title="Qarz to'lovi" size="sm">
        {payingDebt && (
          <PayDebtModal debtId={payingDebt.id} remaining={payingDebt.remaining} onClose={() => setPayingDebt(null)} />
        )}
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={!!viewingReceipt} onClose={() => setViewingReceipt(null)} title={`Chek #${viewingReceipt?.number}`} size="md">
        {viewingReceipt && (
          <SaleReceiptModal saleId={viewingReceipt.id} saleNumber={viewingReceipt.number} onClose={() => setViewingReceipt(null)} />
        )}
      </Modal>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "debt" | "paid">("all");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => customersApi.getAll(search || undefined),
  });

  const filtered = useMemo(() => {
    let list = customers;
    if (filter === "debt") list = list.filter((c: any) => (c.totalDebt ?? 0) > 0);
    if (filter === "paid") list = list.filter((c: any) => (c.totalDebt ?? 0) === 0);
    return list;
  }, [customers, filter]);

  const totalDebt = useMemo(
    () => customers.reduce((s: number, c: any) => s + (c.totalDebt ?? 0), 0),
    [customers]
  );

  const debtorCount = useMemo(
    () => customers.filter((c: any) => (c.totalDebt ?? 0) > 0).length,
    [customers]
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => {
      toast.success("Mijoz o'chirildi");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDeleteTarget(null);
      if (selected?.id === deleteTarget?.id) setSelected(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Xatolik"),
  });

  if (selected) {
    return (
      <div className="space-y-4">
        <CustomerDetail
          customer={selected}
          onBack={() => setSelected(null)}
          onEdit={() => { setEditTarget(selected); setShowForm(true); }}
          onDelete={() => setDeleteTarget(selected)}
        />
        <Modal
          isOpen={showForm && !!editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          title="Mijozni tahrirlash"
          size="sm"
        >
          {editTarget && (
            <CustomerFormModal customer={editTarget} onClose={() => {
              setShowForm(false);
              setEditTarget(null);
              qc.invalidateQueries({ queryKey: ["customers"] }).then(() => {
                customersApi.getOne(selected.id).then(setSelected).catch(() => {});
              });
            }} />
          )}
        </Modal>
        <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="O'chirishni tasdiqlash" size="sm">
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              <span className="font-semibold">{deleteTarget?.name}</span> mijozini o'chirishni xohlaysizmi?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Bekor</Button>
              <Button variant="danger" className="flex-1" isLoading={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
                O'chirish
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mijozlar</h1>
          <p className="text-gray-500 text-sm">{customers.length} ta mijoz · {debtorCount} ta qarzdor</p>
        </div>
        <Button size="sm" leftIcon={<Plus size={15} />} onClick={() => { setEditTarget(null); setShowForm(true); }}>
          Yangi
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Users size={14} className="text-indigo-400" />
          </div>
          <p className="text-xs text-gray-400">Jami mijozlar</p>
          <p className="font-bold text-gray-900 text-lg">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <AlertTriangle size={14} className="text-red-400" />
          </div>
          <p className="text-xs text-gray-400">Qarzdorlar</p>
          <p className="font-bold text-red-600 text-lg">{debtorCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <DollarSign size={14} className="text-red-400" />
          </div>
          <p className="text-xs text-gray-400">Jami qarz</p>
          <p className="font-bold text-red-600 text-sm">{fmt(totalDebt)}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="space-y-2">
        <Input
          placeholder="Ism yoki telefon bo'yicha qidirish..."
          icon={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5">
          {[
            { k: "all", l: "Barchasi" },
            { k: "debt", l: "Qarzdorlar" },
            { k: "paid", l: "To'langan" },
          ].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === k ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <User size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">Mijozlar topilmadi</p>
          <button onClick={() => { setEditTarget(null); setShowForm(true); }} className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">
            + Yangi mijoz qo'shish
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((c: any) => {
            const debt = c.totalDebt ?? 0;
            return (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3 cursor-pointer transition-all ${
                  debt > 0
                    ? "bg-red-50/50 border-red-200 hover:border-red-300 hover:shadow-sm"
                    : "bg-white border-gray-100 hover:border-indigo-300 hover:shadow-sm"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${debt > 0 ? "bg-red-100" : "bg-indigo-50"}`}>
                  <User size={18} className={debt > 0 ? "text-red-500" : "text-indigo-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Phone size={10} />{c.phone}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {debt > 0 ? (
                    <>
                      <p className="font-bold text-red-600 text-sm">{fmt(debt)}</p>
                      <p className="text-xs text-red-400">qarz</p>
                    </>
                  ) : (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">To'langan</span>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        title={editTarget ? "Mijozni tahrirlash" : "Yangi mijoz"}
        size="sm"
      >
        <CustomerFormModal customer={editTarget} onClose={() => { setShowForm(false); setEditTarget(null); }} />
      </Modal>
    </div>
  );
}