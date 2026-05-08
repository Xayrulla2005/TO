// src/features/sales/PaymentModal.tsx — TO'LIQ TUZATILGAN
// Tuzatishlar:
// 1. Qidiruv filter — faqat mos keladiganlar ko'rsatiladi
//    "b" yozganda hamma chiqmasin — phoneMatch bo'sh string tekshiruvi qo'shildi
// 2. debtorPhone backend ga uzatiladi
// 3. Mijoz tanlanganda qidiruv tozalanadi
// 4. "Barchasi naqd / karta" tez tugmalari
// 5. Mavjud qarz ko'rsatiladi

import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/shared/lib/axios";
import { toast } from "@/shared/ui/Toast";
import { Customer } from "@/features/customer/api/customers.api";
import {
  X,
  Banknote,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Search,
  UserPlus,
  User,
  Check,
  Loader2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmtInput = (val: string): string => {
  const clean = val.replace(/[^\d.]/g, "");
  const parts = clean.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.length > 2 ? parts[0] + "." + parts[1] : parts.join(".");
};

const parseInput = (val: string): number => {
  const n = parseFloat(val.replace(/\s/g, ""));
  return isNaN(n) ? 0 : n;
};

const fmtCurrency = (n: number): string =>
  "$" +
  new Intl.NumberFormat("uz-UZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n || 0);

const formatPhone = (raw: string): string => {
  let digits = raw.replace(/\D/g, "");
  if (!digits.startsWith("998")) digits = "998" + digits;
  digits = digits.slice(0, 12);
  const d = digits.slice(3);
  let f = "+998";
  if (d.length > 0) f += " " + d.slice(0, 2);
  if (d.length > 2) f += " " + d.slice(2, 5);
  if (d.length > 5) f += " " + d.slice(5, 7);
  if (d.length > 7) f += " " + d.slice(7, 9);
  return f;
};

// ─────────────────────────────────────────────────────────────
// PAYMENT MODAL
// ─────────────────────────────────────────────────────────────
export function PaymentModal({
  isOpen,
  onClose,
  totalAmount,
  onConfirm,
  isSubmitting,
}: PaymentModalProps) {
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const cash = useMemo(() => parseInput(cashAmount), [cashAmount]);
  const card = useMemo(() => parseInput(cardAmount), [cardAmount]);

  const debtAmount = useMemo(() => {
    const res = totalAmount - cash - card;
    return res > 0.009 ? parseFloat(res.toFixed(2)) : 0;
  }, [totalAmount, cash, card]);

  const isOverpaid = cash + card > totalAmount + 0.01;
  const hasDebt = debtAmount > 0;

  // ── Mijozlarni yuklash ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setLoadingCustomers(true);
    api
      .get("/customers", { params: { limit: 9999, page: 1 } })
      .then((res) => {
        const raw = res.data;
        const list: Customer[] = Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
            ? raw
            : [];
        setAllCustomers(list);
      })
      .catch(() => {
        setAllCustomers([]);
        toast.error("Mijozlarni yuklashda xato");
      })
      .finally(() => setLoadingCustomers(false));
  }, [isOpen]);

  // ── Modal yopilganda reset ────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setCashAmount("");
      setCardAmount("");
      setSearchQuery("");
      setSelectedCustomer(null);
      setShowNewForm(false);
      setNewName("");
      setNewPhone("");
    }
  }, [isOpen]);

  // ── Mijoz qidirish — TO'G'RILANGAN FILTER ────────────────
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // Bo'sh yoki juda qisqa qidiruv — hech narsa ko'rsatmaymiz
    if (!q || q.length < 1) return [];
    if (!Array.isArray(allCustomers) || allCustomers.length === 0) return [];

    // Telefon raqami qidiruvini faqat raqam kiritilganda ishlatamiz
    const qDigits = q.replace(/\D/g, "");
    const isDigitSearch = qDigits.length >= 3;

    return allCustomers
      .filter((c) => {
        // ✅ Ism bo'yicha: faqat harf kiritilganda
        const nameMatch = c.name?.toLowerCase().includes(q);

        // ✅ Telefon bo'yicha: FAQAT kamida 3 ta raqam kiritilganda
        const phoneMatch =
          isDigitSearch && c.phone?.replace(/\D/g, "").includes(qDigits);

        return nameMatch || (phoneMatch ?? false);
      })
      .slice(0, 10);
  }, [searchQuery, allCustomers]);

  // ── Tasdiqlash ────────────────────────────────────────────
  const customerInfoValid =
    !hasDebt ||
    !!selectedCustomer ||
    (showNewForm && newName.trim() && newPhone.length >= 12);

  const handleConfirm = useCallback(() => {
    if (isOverpaid) {
      toast.error("To'lov summasi ko'p!");
      return;
    }
    if (!customerInfoValid) {
      toast.error("Nasiya uchun mijoz kerak!");
      return;
    }

    onConfirm({
      cashAmount: cash,
      cardAmount: card,
      debtAmount,
      customerId:
        selectedCustomer?.id === "temp" ? undefined : selectedCustomer?.id,
      customerName:
        selectedCustomer?.name || (showNewForm ? newName.trim() : undefined),
      customerPhone:
        selectedCustomer?.phone || (showNewForm ? newPhone.trim() : undefined),
    });
  }, [
    cash,
    card,
    debtAmount,
    selectedCustomer,
    showNewForm,
    newName,
    newPhone,
    isOverpaid,
    customerInfoValid,
    onConfirm,
  ]);

  // ── Tez tugmalar ──────────────────────────────────────────
  const handleAllCash = useCallback(() => {
    setCashAmount(String(totalAmount));
    setCardAmount("");
  }, [totalAmount]);

  const handleAllCard = useCallback(() => {
    setCardAmount(String(totalAmount));
    setCashAmount("");
  }, [totalAmount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            To&apos;lovni rasmiylashtirish
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* ── Jami summa ── */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-5 text-white shadow-lg">
            <p className="text-indigo-100 text-xs uppercase tracking-wider font-medium">
              Jami to&apos;lov
            </p>
            <p className="text-3xl font-black">{fmtCurrency(totalAmount)}</p>
          </div>

          {/* ── Tez tugmalar ── */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleAllCash}
              className="py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700
                         rounded-xl font-semibold text-xs hover:bg-emerald-100 transition-colors
                         flex items-center justify-center gap-1.5"
            >
              <Banknote size={14} /> Barchasi naqd
            </button>
            <button
              onClick={handleAllCard}
              className="py-2.5 bg-blue-50 border border-blue-200 text-blue-700
                         rounded-xl font-semibold text-xs hover:bg-blue-100 transition-colors
                         flex items-center justify-center gap-1.5"
            >
              <CreditCard size={14} /> Barchasi karta
            </button>
          </div>

          {/* ── To'lov maydonlari ── */}
          <div className="space-y-3">
            {/* Naqd */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-2">
                <Banknote size={14} className="text-emerald-500" /> NAQD PUL
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={cashAmount}
                onChange={(e) => setCashAmount(fmtInput(e.target.value))}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl
                           focus:border-emerald-500 focus:bg-white outline-none transition-all
                           text-lg font-semibold"
                placeholder="0"
              />
            </div>

            {/* Karta */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-2">
                <CreditCard size={14} className="text-blue-500" /> KARTA
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={cardAmount}
                onChange={(e) => setCardAmount(fmtInput(e.target.value))}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl
                           focus:border-blue-500 focus:bg-white outline-none transition-all
                           text-lg font-semibold"
                placeholder="0"
              />
            </div>
          </div>

          {/* ── To'lov holati ── */}
          <div
            className={`p-4 rounded-xl border-2 transition-all ${
              isOverpaid
                ? "bg-red-50 border-red-200"
                : hasDebt
                  ? "bg-amber-50 border-amber-200"
                  : "bg-emerald-50 border-emerald-200"
            }`}
          >
            <div className="flex justify-between items-center">
              <span
                className={`text-sm font-bold flex items-center gap-2 ${
                  isOverpaid
                    ? "text-red-700"
                    : hasDebt
                      ? "text-amber-700"
                      : "text-emerald-700"
                }`}
              >
                {isOverpaid ? (
                  <AlertCircle size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {isOverpaid
                  ? "Ortiqcha to'lov"
                  : hasDebt
                    ? "Nasiya (Qarz)"
                    : "To'liq to'landi ✓"}
              </span>
              <span
                className={`font-black text-xl ${
                  isOverpaid
                    ? "text-red-700"
                    : hasDebt
                      ? "text-amber-700"
                      : "text-emerald-700"
                }`}
              >
                {isOverpaid
                  ? fmtCurrency(cash + card - totalAmount)
                  : hasDebt
                    ? fmtCurrency(debtAmount)
                    : fmtCurrency(0)}
              </span>
            </div>
            {hasDebt && (
              <p className="text-xs text-amber-600 mt-1.5">
                Naqd: {fmtCurrency(cash)} + Karta: {fmtCurrency(card)} ={" "}
                {fmtCurrency(cash + card)}
                &nbsp;·&nbsp;Qarz:{" "}
                <span className="font-bold">{fmtCurrency(debtAmount)}</span>
              </p>
            )}
          </div>

          {/* ── Mijoz tanlash ── */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-2 border-b text-[10px] font-black text-gray-400 uppercase flex justify-between items-center">
              <span>Mijoz ma&apos;lumotlari</span>
              {hasDebt ? (
                <span className="text-red-500">* Nasiya uchun shart</span>
              ) : (
                <span className="text-gray-400">Ixtiyoriy</span>
              )}
            </div>

            <div className="p-3">
              {selectedCustomer ? (
                /* Tanlangan mijoz */
                <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">
                        {selectedCustomer.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedCustomer.phone}
                      </p>
                      {Number((selectedCustomer as any).totalDebt) > 0 && (
                        <p className="text-xs text-red-500 font-semibold mt-0.5">
                          Mavjud qarz:{" "}
                          {fmtCurrency(
                            Number((selectedCustomer as any).totalDebt),
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setSearchQuery("");
                    }}
                    className="p-1.5 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                /* Qidiruv */
                <div className="space-y-2">
                  <div className="relative">
                    {loadingCustomers ? (
                      <Loader2
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
                        size={16}
                      />
                    ) : (
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={16}
                      />
                    )}
                    <input
                      autoComplete="off"
                      type="text"
                      placeholder={
                        loadingCustomers
                          ? "Yuklanmoqda..."
                          : "Ism yoki telefon (kamida 3 raqam)..."
                      }
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowNewForm(false);
                      }}
                      disabled={loadingCustomers}
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl
                                 outline-none focus:border-indigo-400 transition-all text-sm
                                 disabled:opacity-60 bg-white"
                    />
                  </div>

                  {/* ✅ Qidiruv natijalari — faqat mos kelganlar */}
                  {filteredCustomers.length > 0 && (
                    <div
                      className="border border-gray-100 rounded-xl divide-y divide-gray-50
                                    max-h-44 overflow-y-auto bg-white shadow-sm"
                    >
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setSearchQuery("");
                            setShowNewForm(false);
                          }}
                          className="w-full px-3 py-2.5 hover:bg-indigo-50 flex items-center
                                     justify-between text-left transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {c.name}
                            </p>
                            <p className="text-xs text-gray-400">{c.phone}</p>
                            {Number((c as any).totalDebt) > 0 && (
                              <p className="text-xs text-red-400 font-medium">
                                Qarz:{" "}
                                {fmtCurrency(Number((c as any).totalDebt))}
                              </p>
                            )}
                          </div>
                          <Check
                            size={14}
                            className="text-indigo-400 flex-shrink-0 ml-2"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Topilmadi — yangi qo'shish */}
                  {searchQuery.trim().length >= 2 &&
                    filteredCustomers.length === 0 &&
                    !showNewForm && (
                      <button
                        onClick={() => {
                          setShowNewForm(true);
                          setNewName(searchQuery.trim());
                          setNewPhone("");
                        }}
                        className="w-full p-3 border-2 border-dashed border-indigo-200 rounded-xl
                                 text-indigo-600 flex items-center justify-center gap-2
                                 font-semibold text-sm hover:bg-indigo-50 transition-all"
                      >
                        <UserPlus size={15} />
                        &ldquo;{searchQuery.trim()}&rdquo; — yangi mijoz
                        qo&apos;shish
                      </button>
                    )}

                  {/* Yangi mijoz formasi */}
                  {showNewForm && (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
                      <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase">
                        <UserPlus size={13} /> Yangi mijoz
                      </div>
                      <input
                        autoComplete="off"
                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm
                                   outline-none focus:border-indigo-400 bg-white"
                        placeholder="Mijoz ismi *"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                      <input
                        autoComplete="off"
                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm
             outline-none focus:border-indigo-400 bg-white"
                        placeholder="+998 90 000 00 00 *"
                        value={newPhone}
                        onChange={(e) =>
                          setNewPhone(formatPhone(e.target.value))
                        }
                        onFocus={() => {
                          if (!newPhone) setNewPhone("+998 ");
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setShowNewForm(false);
                            setNewName("");
                            setNewPhone("");
                          }}
                          className="flex-1 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                        >
                          Bekor
                        </button>
                        <button
                          disabled={!newName.trim() || newPhone.length < 12}
                          onClick={() => {
                            setSelectedCustomer({
                              id: "temp",
                              name: newName.trim(),
                              phone: newPhone,
                            } as any);
                            setShowNewForm(false);
                            setSearchQuery("");
                          }}
                          className="flex-[2] py-2 bg-indigo-600 text-white rounded-xl
                                     font-semibold text-xs hover:bg-indigo-700
                                     disabled:opacity-50 transition-colors"
                        >
                          Saqlash va tanlash
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Nasiya uchun ogohlantirish */}
                  {hasDebt && !searchQuery && !showNewForm && (
                    <p className="text-xs text-amber-600 text-center py-1.5 bg-amber-50 rounded-lg">
                      ⚠️ Nasiya uchun mijoz tanlash yoki qo&apos;shish shart
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-4 border-t bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold
                       text-gray-600 hover:bg-white transition-all text-sm"
          >
            Yopish
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || isOverpaid || !customerInfoValid}
            className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm
                       hover:bg-indigo-700 shadow-lg shadow-indigo-100/50
                       disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "To'lovni tasdiqlash"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
