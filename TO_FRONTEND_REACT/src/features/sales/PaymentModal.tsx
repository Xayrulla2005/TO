// Nasiya input olib tashlandi — avtomatik hisoblanadi (qolgan summa)
import { useState, useEffect } from 'react';
import { toast } from '@/shared/ui/Toast';
import { customersApi, Customer } from '@/features/customer/api/customers.api';
import {
  X, Banknote, CreditCard, AlertCircle, CheckCircle2,
  Search, UserPlus, User, Phone, Check, Clock,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  onConfirm: (paymentData: PaymentData) => void;
  isSubmitting?: boolean;
}

export interface PaymentData {
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
}

function fmtInput(val: string): string {
  const dotIdx = val.indexOf('.');
  if (dotIdx !== -1) {
    const intPart = val.slice(0, dotIdx).replace(/\D/g, '');
    const decPart = val.slice(dotIdx + 1).replace(/\D/g, '');
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + decPart;
  }
  return val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function parseInput(val: string): number {
  const n = parseFloat(val.replace(/\s/g, ''));
  return isNaN(n) ? 0 : n;
}

function fmtCurrency(n: number): string {
  const safe = isNaN(n) ? 0 : n;
  const v = parseFloat(safe.toFixed(4));
  return '$' + new Intl.NumberFormat('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(v);
}

function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (!digits.startsWith('998')) digits = '998' + digits;
  if (digits.length > 12) digits = digits.slice(0, 12);
  const d = digits.slice(3);
  let f = '+998';
  if (d.length > 0) f += ' ' + d.slice(0, 2);
  if (d.length > 2) f += ' ' + d.slice(2, 5);
  if (d.length > 5) f += ' ' + d.slice(5, 7);
  if (d.length > 7) f += ' ' + d.slice(7, 9);
  return f;
}

export function PaymentModal({
  isOpen,
  onClose,
  totalAmount,
  onConfirm,
  isSubmitting,
}: PaymentModalProps) {
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

  // Nasiya = jami - (naqd + karta), never negative — kept for submission logic
  const rawDebt = parseFloat((totalAmount - cash - card).toFixed(10));
  const debtAmount = Math.max(0, isNaN(rawDebt) ? 0 : rawDebt);
  const hasDebt = debtAmount >= 0.01;

  // Overpaid: cash+card exceeds total by more than rounding tolerance
  const isOverpaid = (cash + card) > totalAmount + 0.005;

  const handleCashChange = (raw: string) => {
    setCashAmount(fmtInput(raw.replace(/[^\d.\s]/g, '').replace(/\s/g, '')));
  };

  const handleCardChange = (raw: string) => {
    setCardAmount(fmtInput(raw.replace(/[^\d.\s]/g, '').replace(/\s/g, '')));
  };

  const filtered = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allCustomers.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneDigits = c.phone.replace(/\D/g, '');
      const queryDigits = q.replace(/\D/g, '');
      const phoneMatch = queryDigits.length > 0 && phoneDigits.includes(queryDigits);
      return nameMatch || phoneMatch;
    });
  })();

  useEffect(() => {
    if (!isOpen) return;
    customersApi
      .getAll()
      .then((list) => setAllCustomers(list))
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setCashAmount('');
      setCardAmount('');
      setSearchQuery('');
      setSelectedCustomer(null);
      setShowNewForm(false);
      setNewName('');
      setNewPhone('');
    }
  }, [isOpen, totalAmount]);

  // Unified customer validity check (used in both disabled prop and handleConfirm)
  const customerInfoValid =
    !hasDebt ||
    !!selectedCustomer ||
    (showNewForm && newName.trim().length > 0 && newPhone.trim().length > 0);

  const handleConfirm = () => {
    if (isOverpaid) {
      toast.error("To'lov summasi jami summadan oshib ketdi!");
      return;
    }
    if (!customerInfoValid) {
      toast.error("Qarzga savdo uchun mijoz ma'lumotlari shart!");
      return;
    }

    onConfirm({
      cashAmount: cash,
      cardAmount: card,
      debtAmount,
      customerId: selectedCustomer?.id || undefined,
      customerName: selectedCustomer?.name || (showNewForm ? newName.trim() : undefined),
      customerPhone: selectedCustomer?.phone || (showNewForm ? newPhone.trim() : undefined),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
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

          {/* Payment inputs */}
          <div className="space-y-3">

            {/* Naqd */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                <Banknote size={16} className="text-emerald-500" /> Naqd pul
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cashAmount}
                  onChange={(e) => handleCashChange(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 text-lg font-semibold transition-colors"
                />
              </div>
            </div>

            {/* Karta */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                <CreditCard size={16} className="text-blue-500" /> Karta
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cardAmount}
                  onChange={(e) => handleCardChange(e.target.value)}
                  placeholder="0"
                  className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-lg font-semibold transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div
            className={`rounded-xl p-4 space-y-2 text-sm border-2 ${
              isOverpaid
                ? 'bg-red-50 border-red-200'
                : hasDebt
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            {/* Cash row */}
            {cash > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <Banknote size={12} className="text-emerald-500" />Naqd:
                </span>
                <span className="font-semibold">{fmtCurrency(cash)}</span>
              </div>
            )}

            {/* Card row */}
            {card > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <CreditCard size={12} className="text-blue-500" />Karta:
                </span>
                <span className="font-semibold">{fmtCurrency(card)}</span>
              </div>
            )}

            {/* Remaining debt row — current sale only */}
            {hasDebt && !isOverpaid && (
              <div className="flex justify-between">
                <span className="text-amber-700 flex items-center gap-1">
                  <Clock size={12} className="text-amber-500" />Qoldiq (nasiya):
                </span>
                <span className="font-semibold text-amber-700">{fmtCurrency(debtAmount)}</span>
              </div>
            )}

            {/* Status row */}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
              {isOverpaid ? (
                <>
                  <span className="text-red-600 flex items-center gap-1">
                    <AlertCircle size={14} />Ortiqcha:
                  </span>
                  <span className="text-red-600">{fmtCurrency(cash + card - totalAmount)}</span>
                </>
              ) : (
                <>
                  <span className={`flex items-center gap-1 ${hasDebt ? 'text-amber-700' : 'text-emerald-700'}`}>
                    <CheckCircle2 size={14} />To'lov qabul qilindi
                  </span>
                  <span className={hasDebt ? 'text-amber-700' : 'text-emerald-700'}>✓</span>
                </>
              )}
            </div>
          </div>

          {/* Mijoz tanlash */}
          <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <User size={15} className="text-indigo-500" />
                Mijoz
                {hasDebt ? (
                  <span className="text-xs text-red-400 font-normal ml-1">* majburiy</span>
                ) : (
                  <span className="text-xs text-gray-400 font-normal ml-1">(ixtiyoriy)</span>
                )}
              </span>
              {selectedCustomer && (
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSearchQuery('');
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
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
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
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

                  {searchQuery.trim().length > 0 && filtered.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                      {filtered.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setShowNewForm(false);
                            setSearchQuery('');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left"
                        >
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

                  {searchQuery.trim().length > 0 && filtered.length === 0 && !showNewForm && (
                    <div className="flex items-center justify-between px-1 py-1">
                      <span className="text-xs text-gray-400">Mijoz topilmadi</span>
                      <button
                        onClick={() => {
                          setShowNewForm(true);
                          setNewName(searchQuery);
                          setNewPhone('+998 ');
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <UserPlus size={13} /> Yangi mijoz
                      </button>
                    </div>
                  )}

                  {showNewForm && (
                    <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <UserPlus size={12} /> Yangi mijoz
                      </p>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) =>
                          setNewName(
                            e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1),
                          )
                        }
                        placeholder="To'liq ism *"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                      />
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '' || raw === '+') {
                            setNewPhone('+998 ');
                            return;
                          }
                          setNewPhone(formatPhone(raw));
                        }}
                        onFocus={() => {
                          if (!newPhone) setNewPhone('+998 ');
                        }}
                        placeholder="+998 90 123 45 67"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setShowNewForm(false);
                            setSearchQuery('');
                          }}
                          className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          Bekor
                        </button>
                        <button
                          onClick={() => {
                            if (!newName.trim() || !newPhone.trim()) {
                              toast.error('Ism va telefon shart!');
                              return;
                            }
                            setSelectedCustomer({
                              id: '',
                              name: newName.trim(),
                              phone: newPhone.trim(),
                              totalDebt: 0,
                              createdAt: '',
                              updatedAt: '',
                            });
                            setShowNewForm(false);
                          }}
                          className="flex-1 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition-colors"
                        >
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

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-3 border-t border-gray-100 bg-white flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || isOverpaid || !customerInfoValid}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saqlanmoqda...
              </span>
            ) : (
              'Tasdiqlash'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}