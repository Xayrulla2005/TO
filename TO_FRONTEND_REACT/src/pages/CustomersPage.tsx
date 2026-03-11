import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/lib/axios';
import { formatCurrency } from '../shared/lib/utils';
import { Search, User, Phone, CreditCard, Banknote, AlertCircle, ChevronRight } from 'lucide-react';
import { format, parseISO, getMonth, getYear } from 'date-fns';
import { toast } from '../shared/ui/Toast';
import { Modal } from '../shared/ui/Modal';
import { Input } from '../shared/ui/Input';
import { Button } from '../shared/ui/Button';

// ── Types ──────────────────────────────────────────────────
interface DebtRecord {
  id: string;
  debtorName: string;
  debtorPhone: string;
  originalAmount: number;
  remainingAmount: number;
  status: string;
  saleId: string;
  createdAt: string;
}

interface Customer {
  name: string;
  phone: string;
  debts: DebtRecord[];
  totalDebt: number;
  totalOriginal: number;
  totalSales: number;
}

interface Sale {
  id: string;
  saleNumber: string;
  grandTotal: number;
  status: string;
  completedAt?: string;
  createdAt: string;
  payments?: { method: string; amount: number }[];
}

const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

// ── API helpers ─────────────────────────────────────────────
async function fetchAllDebts(): Promise<DebtRecord[]> {
  const res = await api.get('/debts?limit=1000');
  const raw = res.data?.data ?? res.data ?? [];
  return Array.isArray(raw) ? raw : [];
}

async function fetchSalesByPhone(phone: string): Promise<Sale[]> {
  // debts orqali saleId larni olib, sale API dan ma'lumot olamiz
  const res = await api.get(`/debts?limit=1000`);
  const raw = res.data?.data ?? res.data ?? [];
  const customerDebts = raw.filter((d: DebtRecord) => d.debtorPhone === phone);
  
  const sales: Sale[] = [];
  for (const debt of customerDebts) {
    try {
      const saleRes = await api.get(`/sales/${debt.saleId}`);
      if (saleRes.data) sales.push(saleRes.data);
    } catch {}
  }
  return sales;
}

// ── Group debts into customers ──────────────────────────────
function groupToCustomers(debts: DebtRecord[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const d of debts) {
    const key = d.debtorPhone;
    if (!map.has(key)) {
      map.set(key, { name: d.debtorName, phone: d.debtorPhone, debts: [], totalDebt: 0, totalOriginal: 0, totalSales: 0 });
    }
    const c = map.get(key)!;
    c.debts.push(d);
    c.totalDebt += Number(d.remainingAmount);
    c.totalOriginal += Number(d.originalAmount);
    c.totalSales += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.totalDebt - a.totalDebt);
}

// ── STATUS badge ────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    PENDING: 'bg-red-100 text-red-700',
    PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<string, string> = {
    PENDING: "To'lanmagan", PARTIALLY_PAID: 'Qisman', PAID: "To'langan", CANCELLED: 'Bekor'
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg[status] || 'bg-gray-100 text-gray-500'}`}>{labels[status] || status}</span>;
}

// ── Customer Detail Modal ───────────────────────────────────
function CustomerDetail({ customer, onPay }: { customer: Customer; onClose: () => void; onPay: (debt: DebtRecord) => void }) {
  const [tab, setTab] = useState<'debts' | 'stats'>('debts');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['customer-sales', customer.phone],
    queryFn: () => fetchSalesByPhone(customer.phone),
  });

  // Stats
  const yearlySales = useMemo(() => sales.filter(s => getYear(parseISO(s.createdAt)) === year), [sales, year]);
  const monthlySales = useMemo(() => yearlySales.filter(s => getMonth(parseISO(s.createdAt)) === month), [yearlySales, month]);
  const yearlyTotal = yearlySales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
  const monthlyTotal = monthlySales.reduce((sum, s) => sum + Number(s.grandTotal), 0);


  return (
    <div className="space-y-4">
      {/* Customer header */}
      <div className="flex items-center gap-3 bg-indigo-50 rounded-xl p-4">
        <div className="w-12 h-12 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0">
          <User size={22} className="text-indigo-700" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-base">{customer.name}</p>
          <p className="text-sm text-gray-500 flex items-center gap-1"><Phone size={12} />{customer.phone}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-400">Jami qarz</p>
          <p className={`font-bold text-lg ${customer.totalDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatCurrency(customer.totalDebt)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['debts', 'stats'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {t === 'debts' ? '💳 Qarzlar' : '📊 Statistika'}
          </button>
        ))}
      </div>

      {/* DEBTS TAB */}
      {tab === 'debts' && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {customer.debts.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">Qarzlar yo'q</p>
          ) : customer.debts.map(d => (
            <div key={d.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{format(parseISO(d.createdAt), 'dd.MM.yyyy')}</span>
                <StatusBadge status={d.status} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Dastlabki</p>
                  <p className="font-semibold text-sm">{formatCurrency(d.originalAmount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Qoldi</p>
                  <p className={`font-bold text-sm ${d.remainingAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(d.remainingAmount)}
                  </p>
                </div>
                {(d.status === 'PENDING' || d.status === 'PARTIALLY_PAID') && (
                  <button onClick={() => onPay(d)}
                    className="ml-2 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-emerald-700 transition-colors">
                    To'lash
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STATS TAB */}
      {tab === 'stats' && (
        <div className="space-y-3">
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(y => y - 1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={16} className="rotate-180" /></button>
            <span className="font-bold text-gray-800 flex-1 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={16} /></button>
          </div>

          {/* Yearly stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-500">Yillik savdo</p>
              <p className="font-bold text-blue-800">{formatCurrency(yearlyTotal)}</p>
              <p className="text-xs text-blue-400">{yearlySales.length} ta</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-xs text-purple-500">Jami savdo</p>
              <p className="font-bold text-purple-800">{formatCurrency(sales.reduce((s, x) => s + Number(x.grandTotal), 0))}</p>
              <p className="text-xs text-purple-400">{sales.length} ta</p>
            </div>
          </div>

          {/* Month selector */}
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 min-w-max pb-1">
              {MONTHS.map((m, i) => (
                <button key={i} onClick={() => setMonth(i)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${month === i ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly sales */}
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold text-gray-700">{MONTHS[month]} {year}</p>
              <p className="font-bold text-indigo-600">{formatCurrency(monthlyTotal)}</p>
            </div>
            {salesLoading ? (
              <p className="text-xs text-gray-400 text-center py-3">Yuklanmoqda...</p>
            ) : monthlySales.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Bu oyda savdo yo'q</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {monthlySales.map(s => {
                  const cashPay = s.payments?.find(p => p.method === 'CASH');
                  const cardPay = s.payments?.find(p => p.method === 'CARD');
                  const debtPay = s.payments?.find(p => p.method === 'DEBT');
                  return (
                    <div key={s.id} className="bg-white rounded-lg p-2.5 border border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-gray-500">#{s.saleNumber}</span>
                        <span className="font-bold text-sm text-gray-800">{formatCurrency(s.grandTotal)}</span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        {cashPay && <span className="text-xs text-emerald-600 flex items-center gap-0.5"><Banknote size={10} />{formatCurrency(cashPay.amount)}</span>}
                        {cardPay && <span className="text-xs text-blue-600 flex items-center gap-0.5"><CreditCard size={10} />{formatCurrency(cardPay.amount)}</span>}
                        {debtPay && <span className="text-xs text-red-500 flex items-center gap-0.5"><AlertCircle size={10} />{formatCurrency(debtPay.amount)}</span>}
                        <span className="text-xs text-gray-400 ml-auto">{format(parseISO(s.createdAt), 'dd.MM')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pay Debt Modal ──────────────────────────────────────────
function PayDebtModal({ debt, onClose }: { debt: DebtRecord; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(debt.remainingAmount));
  const [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`/debts/${debt.id}/payment`, {
        amount: Number(amount),
        method,
        notes: note || undefined,
      });
    },
    onSuccess: () => {
      toast.success("To'lov muvaffaqiyatli amalga oshirildi!");
      qc.invalidateQueries({ queryKey: ['all-debts'] });
      qc.invalidateQueries({ queryKey: ['customer-sales'] });
      onClose();
    },
    onError: () => toast.error("Xatolik yuz berdi"),
  });

  return (
    <div className="space-y-4">
      <div className="bg-red-50 rounded-xl p-3 text-sm">
        <p className="text-red-600 font-semibold">Qarz summasi: {formatCurrency(debt.remainingAmount)}</p>
        <p className="text-gray-500 text-xs mt-0.5">{debt.debtorName} — {debt.debtorPhone}</p>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To'lov summasi</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          max={debt.remainingAmount} min={1}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 font-semibold" />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To'lov usuli</label>
        <div className="flex gap-2">
          {(['CASH', 'CARD'] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${method === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {m === 'CASH' ? <><Banknote size={15} />Naqd</> : <><CreditCard size={15} />Karta</>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Izoh (ixtiyoriy)</label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Izoh..."
          className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 text-sm" />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Bekor</Button>
        <Button className="flex-1" isLoading={mutation.isPending}
          onClick={() => {
            if (!amount || Number(amount) <= 0) { toast.error("Summa kiriting"); return; }
            if (Number(amount) > debt.remainingAmount) { toast.error("Summa qarzdan oshib ketdi"); return; }
            mutation.mutate();
          }}>
          To'lash
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [payingDebt, setPayingDebt] = useState<DebtRecord | null>(null);
  const [filter, setFilter] = useState<'all' | 'debt' | 'paid'>('all');

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['all-debts'],
    queryFn: fetchAllDebts,
  });

  const customers = useMemo(() => groupToCustomers(debts), [debts]);

  const filtered = useMemo(() => {
    let list = customers;
    if (filter === 'debt') list = list.filter(c => c.totalDebt > 0);
    if (filter === 'paid') list = list.filter(c => c.totalDebt === 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return list;
  }, [customers, search, filter]);

  const totalDebt = customers.reduce((s, c) => s + c.totalDebt, 0);
  const debtors = customers.filter(c => c.totalDebt > 0).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mijozlar</h1>
        <p className="text-gray-500 text-sm">{customers.length} ta mijoz · {debtors} ta qarzdor</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-xs text-gray-400">Jami mijozlar</p>
          <p className="font-bold text-gray-900 text-lg">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-xs text-gray-400">Qarzdorlar</p>
          <p className="font-bold text-red-600 text-lg">{debtors}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-xs text-gray-400">Jami qarz</p>
          <p className="font-bold text-red-600 text-sm">{formatCurrency(totalDebt)}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="space-y-2">
        <Input placeholder="Ism yoki telefon bo'yicha qidirish..." icon={<Search size={16} />}
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1.5">
          {[{ k: 'all', l: 'Barchasi' }, { k: 'debt', l: '🔴 Qarzdorlar' }, { k: 'paid', l: '✅ To\'langan' }].map(({ k, l }) => (
            <button key={k} onClick={() => setFilter(k as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === k ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <User size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">Mijozlar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(c => (
            <div key={c.phone} onClick={() => setSelected(c)}
              className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{c.phone}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {c.totalDebt > 0 ? (
                  <>
                    <p className="font-bold text-red-600 text-sm">{formatCurrency(c.totalDebt)}</p>
                    <p className="text-xs text-gray-400">qarz</p>
                  </>
                ) : (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">To'langan</span>
                )}
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Customer Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)}
        title={selected?.name || 'Mijoz'} size="md">
        {selected && (
          <CustomerDetail customer={selected} onClose={() => setSelected(null)}
            onPay={(debt) => { setPayingDebt(debt); setSelected(null); }} />
        )}
      </Modal>

      {/* Pay Debt Modal */}
      <Modal isOpen={!!payingDebt} onClose={() => { setPayingDebt(null); }}
        title="Qarz to'lovi" size="sm">
        {payingDebt && <PayDebtModal debt={payingDebt} onClose={() => setPayingDebt(null)} />}
      </Modal>
    </div>
  );
}
