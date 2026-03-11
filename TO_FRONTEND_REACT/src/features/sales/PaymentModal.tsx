// src/features/sales/PaymentModal.tsx
import { useState, useEffect } from 'react';
import { toast } from '@/shared/ui/Toast';
import { api } from '@/shared/lib/axios';
import { X, Banknote, CreditCard, AlertCircle, CheckCircle2, Search, UserPlus, User, Phone, Check } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  items?: { productId: string; qty: number; unitPrice: number }[];
  onConfirm: (paymentData: PaymentData) => void;
  isSubmitting?: boolean;
}

export interface PaymentData {
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  customerName?: string;
  customerPhone?: string;
}

interface Customer { name: string; phone: string; }

function fmtInput(val: string): string {
  // kasr son bo'lsa nuqtani saqlash
  const dotIdx = val.indexOf('.');
  if (dotIdx !== -1) {
    const intPart = val.slice(0, dotIdx).replace(/\D/g, '');
    const decPart = val.slice(dotIdx + 1).replace(/\D/g, '');
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return formatted + '.' + decPart;
  }
  const digits = val.replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function parseInput(val: string): number {
  return parseFloat(val.replace(/\s/g, '')) || 0;
}
function fmtCurrency(n: number): string {
  const v = parseFloat(n.toFixed(4));
  return '$' + new Intl.NumberFormat('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(v);
}

export function PaymentModal({ isOpen, onClose, totalAmount, onConfirm, isSubmitting }: PaymentModalProps) {
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const cash = parseInput(cashAmount);
  const card = parseInput(cardAmount);
  const paid = cash + card;
  const debtAmount = Math.max(0, totalAmount - paid);
  const hasDebt = debtAmount >= 1;
  const isOverpaid = paid > totalAmount + 0.5;

  const filtered = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allCustomers.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneDigits = c.phone.replace(/\D/g, '');
      const queryDigits = q.replace(/\D/g, '');
      const phoneMatch = queryDigits.length > 0 && phoneDigits.includes(queryDigits);
      return nameMatch || phoneMatch;
    });
  })();

  useEffect(() => {
    if (!isOpen) return;
    api.get('/debts?limit=1000')
      .then(res => {
        const raw = res.data?.data ?? res.data ?? [];
        const list: Customer[] = raw
          .map((d: any) => ({ name: d.debtorName || '', phone: d.debtorPhone || '' }))
          .filter((c: Customer) => c.name && c.phone);
        const seen = new Set<string>();
        const unique = list.filter((c: Customer) => {
          if (seen.has(c.phone)) return false;
          seen.add(c.phone);
          return true;
        });
        unique.sort((a: Customer, b: Customer) => a.name.localeCompare(b.name, 'uz'));
        setAllCustomers(unique);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setCashAmount(fmtInput(String(totalAmount)));
      setCardAmount('');
      setSearchQuery('');
      setSelectedCustomer(null);
      setShowNewForm(false);
      setNewName('');
      setNewPhone('');
    }
  }, [isOpen, totalAmount]);

  const handleConfirm = () => {
    if (isOverpaid) { toast.error("To'lov summasi jami summadan oshib ketdi!"); return; }
    const customerName = selectedCustomer?.name || (showNewForm ? newName.trim() : '');
    const customerPhone = selectedCustomer?.phone || (showNewForm ? newPhone.trim() : '');
    if (hasDebt && (!customerName || !customerPhone)) {
      toast.error("Qarzga savdo uchun mijoz ma'lumotlari shart!"); return;
    }
    onConfirm({ cashAmount: cash, cardAmount: card, debtAmount, customerName: customerName || undefined, customerPhone: customerPhone || undefined });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">

        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">To'lovni rasmiylashtirish</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Total */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white">
            <div className="text-sm text-indigo-100 mb-0.5">Jami to'lov summasi</div>
            <div className="text-3xl font-bold tracking-tight">{fmtCurrency(totalAmount)}</div>
          </div>

          {/* Cash */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
              <Banknote size={16} className="text-emerald-500" /> Naqd pul
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
              <input type="text" inputMode="decimal" value={cashAmount}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d.\s]/g, '');
                  setCashAmount(fmtInput(raw.replace(/\s/g, '')));
                }} placeholder="0"
                className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 text-lg font-semibold transition-colors" />
            </div>
          </div>

          {/* Card */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
              <CreditCard size={16} className="text-blue-500" /> Karta
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
              <input type="text" inputMode="decimal" value={cardAmount}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d.\s]/g, '');
                  setCardAmount(fmtInput(raw.replace(/\s/g, '')));
                }} placeholder="0"
                className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-lg font-semibold transition-colors" />
            </div>
          </div>

          {/* Summary */}
          <div className={`rounded-xl p-4 space-y-2 text-sm border-2 ${
            isOverpaid ? 'bg-red-50 border-red-200' :
            hasDebt ? 'bg-amber-50 border-amber-200' :
            'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="flex justify-between">
              <span className="text-gray-600">Naqd:</span>
              <span className="font-semibold">{fmtCurrency(cash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Karta:</span>
              <span className="font-semibold">{fmtCurrency(card)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
              {isOverpaid ? (
                <><span className="text-red-600 flex items-center gap-1"><AlertCircle size={14} />Ortiqcha:</span><span className="text-red-600">{fmtCurrency(paid - totalAmount)}</span></>
              ) : hasDebt ? (
                <><span className="text-amber-700 flex items-center gap-1"><AlertCircle size={14} />Qarz qoldi:</span><span className="text-amber-700">{fmtCurrency(debtAmount)}</span></>
              ) : (
                <><span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 size={14} />To'liq to'landi</span><span className="text-emerald-700">✓</span></>
              )}
            </div>
          </div>

          {/* ── Mijoz ── */}
          <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <User size={15} className="text-indigo-500" />
                Mijoz
                {hasDebt
                  ? <span className="text-xs text-red-400 font-normal ml-1">* majburiy</span>
                  : <span className="text-xs text-gray-400 font-normal ml-1">(ixtiyoriy)</span>}
              </span>
              {selectedCustomer && (
                <button onClick={() => { setSelectedCustomer(null); setSearchQuery(''); }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                  O'zgartirish
                </button>
              )}
            </div>

            <div className="p-3 space-y-2">
              {selectedCustomer ? (
                <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{selectedCustomer.name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Phone size={10} />{selectedCustomer.phone}
                    </p>
                  </div>
                  <Check size={18} className="text-indigo-500 flex-shrink-0" />
                </div>
              ) : (
                <>
                  {/* Search — oddiy useState bilan */}
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowNewForm(false);
                      }}
                      placeholder="Ism yoki telefon bo'yicha..."
                      autoComplete="off"
                      className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                    />
                  </div>

                  {/* Natijalar */}
                  {searchQuery.trim().length > 0 && filtered.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                      {filtered.map((c, i) => (
                        <button key={i}
                          onClick={() => { setSelectedCustomer(c); setShowNewForm(false); setSearchQuery(''); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <User size={13} className="text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.phone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Topilmadi */}
                  {searchQuery.trim().length > 0 && filtered.length === 0 && !showNewForm && (
                    <div className="flex items-center justify-between px-1 py-1">
                      <span className="text-xs text-gray-400">Mijoz topilmadi</span>
                      <button onClick={() => { setShowNewForm(true); setNewName(searchQuery); setNewPhone(''); }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                        <UserPlus size={13} /> Yangi mijoz
                      </button>
                    </div>
                  )}

                  {/* Yangi mijoz mini form */}
                  {showNewForm && (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <UserPlus size={12} /> Yangi mijoz
                      </p>
                      <input type="text" value={newName}
                        onChange={e => setNewName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
                        placeholder="To'liq ism *"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
                      <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                        placeholder="Telefon raqami *"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowNewForm(false); setSearchQuery(''); }}
                          className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                          Bekor
                        </button>
                        <button onClick={() => {
                            if (!newName.trim() || !newPhone.trim()) { toast.error('Ism va telefon shart!'); return; }
                            setSelectedCustomer({ name: newName.trim(), phone: newPhone.trim() });
                            setShowNewForm(false);
                          }}
                          className="flex-1 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition-colors">
                          Qo'shish
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>

        {/* Bottom buttons */}
        <div className="flex gap-3 p-5 pt-3 border-t border-gray-100 bg-white flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors">
            Bekor qilish
          </button>
          <button onClick={handleConfirm}
            disabled={isSubmitting || isOverpaid || (hasDebt && !selectedCustomer && !(showNewForm && newName.trim() && newPhone.trim()))}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saqlanmoqda...
              </span>
            ) : 'Tasdiqlash'}
          </button>
        </div>

      </div>
    </div>
  );
}
