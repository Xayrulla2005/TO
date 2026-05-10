// src/pages/CustomersPage.tsx — WITH FULL EXCEL EXPORT
import * as XLSX from "xlsx";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  customersApi,
  Customer,
  Sale,
  SaleReturn,
  DebtPayment,
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
  Search, User, Phone, ChevronRight, Plus, Edit2,
  Banknote, CreditCard, AlertCircle, BarChart2, ShoppingBag,
  Trash2, Package, ArrowLeft, FileText, TrendingUp,
  ChevronDown, ChevronUp, Users, AlertTriangle, DollarSign,
  Calendar, RotateCcw, Download, Share2, Printer, Receipt,
  CheckCircle, Clock, XCircle,
} from "lucide-react";

const fmt = (v: number | string | null | undefined) => `$${formatCurrency(v)}`;

// ─────────────────────────────────────────────────────────────
// EXCEL EXPORT HELPERS — SheetJS (.xlsx)
// ─────────────────────────────────────────────────────────────

/** Barcha mijozlar ro'yxatini .xlsx ga chiqarish */
async function exportCustomersExcel(customers: Customer[]) {
  
  const wsData = [
    ['#', 'Ism', 'Telefon', 'Jami qarz ($)', 'Holati', "Ro'yxatga olingan"],
    ...customers.map((c, i) => [
      i + 1, c.name, c.phone,
      Number(c.totalDebt ?? 0),
      Number(c.totalDebt ?? 0) > 0 ? 'Qarzdor' : "Qarz yo'q",
      format(parseISO(c.createdAt), 'dd.MM.yyyy'),
    ]),
    ['JAMI', `${customers.length} ta mijoz`, '',
      customers.reduce((s, c) => s + Number(c.totalDebt ?? 0), 0), '', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch:5 },{ wch:30 },{ wch:18 },{ wch:14 },{ wch:12 },{ wch:16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mijozlar');
  XLSX.writeFile(wb, `mijozlar_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast.success('Mijozlar ro\'yxati Excel ga yuklab olindi');
}

/** Bitta mijozning savdo tarixini .xlsx ga — SANA FILTER bilan */
async function exportCustomerSalesExcel(
  customer: Customer,
  sales: Sale[],
  dateFrom?: string,
  dateTo?: string,
) {
  

  // Sana filteri qo'llash
  let filtered = sales;
  if (dateFrom || dateTo) {
    filtered = sales.filter(s => {
      const d = (s.completedAt || s.createdAt).slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      return true;
    });
  }

  const dateRange = dateFrom || dateTo
    ? ` (${dateFrom ?? '...'} – ${dateTo ?? '...'})`
    : '';

  // Sheet 1: Mijoz ma'lumotlari + Savdo tarixi
  const infoData: any[][] = [
    ['Mijoz:',        customer.name],
    ['Telefon:',      customer.phone],
    ['Jami qarz:',    `$${Number(customer.totalDebt ?? 0).toFixed(2)}`],
    ['Davr:',         dateRange || 'Barcha vaqt'],
    ['Eksport sanasi:', format(new Date(), 'dd.MM.yyyy HH:mm')],
    [],
    ['Savdo #', 'Sana', 'Jami ($)', "To'lov turi", 'Qarz ($)', 'Qarz holati', 'Qaytarish'],
    ...filtered.map(s => {
      const payMethods = s.payments?.map((p: any) =>
        p.method === 'CASH' ? 'Naqd' : p.method === 'CARD' ? 'Karta' : 'Nasiya'
      ).join(' + ') ?? '—';
      const debtAmount = Number(s.debt?.remainingAmount ?? 0);
      const debtStatus =
        s.debt?.status === 'PAID'           ? "To'liq to'landi" :
        s.debt?.status === 'PARTIALLY_PAID' ? "Qisman to'landi" :
        s.debt?.status === 'PENDING'        ? "To'lanmagan" : '—';
      const returnTotal = s.returns
        ?.filter((r: any) => r.status === 'APPROVED')
        .reduce((sum: number, r: any) => sum + Number(r.refundAmount), 0) ?? 0;
      return [
        s.saleNumber,
        format(parseISO(s.completedAt || s.createdAt), 'dd.MM.yyyy HH:mm'),
        Number(s.grandTotal),
        payMethods,
        debtAmount,
        debtStatus,
        returnTotal > 0 ? -returnTotal : 0,
      ];
    }),
    [],
    ['JAMI', `${filtered.length} ta savdo`,
      filtered.reduce((s, sale) => s + Number(sale.grandTotal), 0),
      '', filtered.reduce((s, sale) => s + Number(sale.debt?.remainingAmount ?? 0), 0), '', ''],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(infoData);
  ws1['!cols'] = [{ wch:20 },{ wch:18 },{ wch:12 },{ wch:20 },{ wch:12 },{ wch:18 },{ wch:12 }];

  // Sheet 2: Mahsulotlar
  const productRows: any[][] = [
    ['Savdo #', 'Mahsulot nomi', 'Miqdor', "O'lchov", 'Narx ($)', 'Jami ($)'],
  ];
  for (const sale of filtered) {
    for (const item of (sale.items || [])) {
      productRows.push([
        sale.saleNumber,
        item.productNameSnapshot,
        Number(item.quantity),
        item.unitSnapshot ?? 'dona',
        Number(item.customUnitPrice),
        Number(item.customTotal),
      ]);
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet(productRows);
  ws2['!cols'] = [{ wch:16 },{ wch:35 },{ wch:10 },{ wch:10 },{ wch:12 },{ wch:12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Savdo tarixi');
  XLSX.utils.book_append_sheet(wb, ws2, 'Mahsulotlar');

  const safeName = customer.name.replace(/[^\w\u0400-\u04FF]/g, '_');
  const suffix   = dateFrom ? `_${dateFrom}` : '';
  XLSX.writeFile(wb, `mijoz_${safeName}${suffix}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast.success(`Savdo tarixi Excel ga yuklab olindi (${filtered.length} ta savdo)`);
}

/** Bitta mijozning statistikasini .xlsx ga */
async function exportCustomerStatsExcel(
  customer: Customer,
  stats: {
    totalSales: number; totalAmount: number; totalDebt: number;
    averageOrderValue: number;
    monthlyStats: Record<string, { count: number; amount: number }>;
  },
) {
  
  const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun',
                  'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

  const ws1 = XLSX.utils.aoa_to_sheet([
    ["Mijoz ma'lumotlari"],
    [],
    ['Ism:',              customer.name],
    ['Telefon:',          customer.phone],
    ['Jami savdolar:',    stats.totalSales],
    ['Jami summa:',       Number(stats.totalAmount)],
    ['Jami qarz:',        Number(stats.totalDebt)],
    ["O'rtacha buyurtma:", Number(stats.averageOrderValue)],
    ['Eksport sanasi:',   format(new Date(), 'dd.MM.yyyy HH:mm')],
  ]);
  ws1['!cols'] = [{ wch:22 },{ wch:28 }];

  const monthlyRows: any[][] = [
    ['Oy', 'Savdolar soni', 'Jami summa ($)', "O'rtacha ($)", 'Ulushi (%)'],
    ...Object.entries(stats.monthlyStats)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, val]) => {
        const [year, month] = key.split('-');
        return [
          `${MONTHS[parseInt(month)-1]} ${year}`,
          val.count,
          Number(val.amount.toFixed(2)),
          Number((val.count > 0 ? val.amount / val.count : 0).toFixed(2)),
          `${stats.totalAmount > 0 ? Math.round((val.amount / stats.totalAmount) * 100) : 0}%`,
        ];
      }),
    ['JAMI', stats.totalSales, Number(stats.totalAmount.toFixed(2)),
      Number(stats.averageOrderValue.toFixed(2)), '100%'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(monthlyRows);
  ws2['!cols'] = [{ wch:18 },{ wch:14 },{ wch:16 },{ wch:14 },{ wch:10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Umumiy');
  XLSX.utils.book_append_sheet(wb, ws2, 'Oylik');
  const safeName = customer.name.replace(/[^\w\u0400-\u04FF]/g, '_');
  XLSX.writeFile(wb, `statistika_${safeName}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast.success('Statistika Excel ga yuklab olindi');
}

/** Qarzdorlar ro'yxatini .xlsx ga */
async function exportDebtorsExcel(customers: Customer[]) {
  const debtors = customers
    .filter(c => Number(c.totalDebt ?? 0) > 0)
    .sort((a, b) => Number(b.totalDebt) - Number(a.totalDebt));
  const total  = debtors.reduce((s, c) => s + Number(c.totalDebt), 0);
  const wsData = [
    ['#', 'Ism', 'Telefon', 'Qarz miqdori ($)', 'Holati'],
    ...debtors.map((c, i) => [i+1, c.name, c.phone, Number(c.totalDebt), "To'lanmagan"]),
    ['JAMI', `${debtors.length} ta qarzdor`, '', total, ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch:5 },{ wch:30 },{ wch:18 },{ wch:16 },{ wch:14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Qarzdorlar');
  XLSX.writeFile(wb, `qarzdorlar_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast.success("Qarzdorlar ro'yxati Excel ga yuklab olindi");
}

/** Barcha mijozlarning savdolarini sana bo'yicha filterlab .xlsx ga */
async function exportAllCustomersSalesExcel(
  customers: Customer[],
  dateFrom: string,
  dateTo: string,
  onProgress?: (current: number, total: number) => void,
) {
  const XLSX = await import('xlsx');
  const wb   = XLSX.utils.book_new();

  // Sheet 1: Barcha savdolar (yig'ma)
  const allRows: any[][] = [
    ['Mijoz', 'Telefon', 'Savdo #', 'Sana', 'Jami ($)', "To'lov turi", 'Qarz ($)', 'Qarz holati'],
  ];

  let grandRevenue = 0;
  let grandDebt    = 0;
  let grandSales   = 0;

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    onProgress?.(i + 1, customers.length);

    try {
      const res  = await customersApi.getSales(c.id, 1, 9999);
      const sales: Sale[] = Array.isArray(res) ? res :
        Array.isArray((res as any).data) ? (res as any).data : [];

      // Sana filteri
      const filtered = sales.filter(s => {
        const d = (s.completedAt || s.createdAt).slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo   && d > dateTo)   return false;
        return true;
      });

      for (const s of filtered) {
        const payMethods = s.payments?.map((p: any) =>
          p.method === 'CASH' ? 'Naqd' : p.method === 'CARD' ? 'Karta' : 'Nasiya'
        ).join(' + ') ?? '—';
        const debtAmt = Number(s.debt?.remainingAmount ?? 0);
        const debtStatus =
          s.debt?.status === 'PAID'           ? "To'liq to'landi" :
          s.debt?.status === 'PARTIALLY_PAID' ? "Qisman to'landi" :
          s.debt?.status === 'PENDING'        ? "To'lanmagan" : '—';

        allRows.push([
          c.name, c.phone,
          s.saleNumber,
          format(parseISO(s.completedAt || s.createdAt), 'dd.MM.yyyy HH:mm'),
          Number(s.grandTotal),
          payMethods,
          debtAmt,
          debtStatus,
        ]);

        grandRevenue += Number(s.grandTotal);
        grandDebt    += debtAmt;
        grandSales++;
      }
    } catch {
      // Xato bo'lsa, o'tkazib yuboramiz
    }
  }

  // Jami qator
  allRows.push([
    'JAMI', `${customers.length} ta mijoz`,
    `${grandSales} ta savdo`, '',
    grandRevenue, '', grandDebt, '',
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(allRows);
  ws1['!cols'] = [
    { wch:28 }, { wch:16 }, { wch:20 }, { wch:18 },
    { wch:12 }, { wch:20 }, { wch:12 }, { wch:16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Barcha savdolar');

  // Sheet 2: Mijozlar jami (har bir mijoz bo'yicha yig'ma)
  const summaryRows: any[][] = [
    ['#', 'Mijoz', 'Telefon', 'Savdolar soni', 'Jami summa ($)', 'Qarz ($)'],
  ];

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    try {
      const res  = await customersApi.getSales(c.id, 1, 9999);
      const sales: Sale[] = Array.isArray(res) ? res :
        Array.isArray((res as any).data) ? (res as any).data : [];

      const filtered = sales.filter(s => {
        const d = (s.completedAt || s.createdAt).slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo   && d > dateTo)   return false;
        return true;
      });

      if (filtered.length > 0) {
        const total = filtered.reduce((s, sale) => s + Number(sale.grandTotal), 0);
        const debt  = filtered.reduce((s, sale) => s + Number(sale.debt?.remainingAmount ?? 0), 0);
        summaryRows.push([i+1, c.name, c.phone, filtered.length, total, debt]);
      }
    } catch {}
  }

  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch:5 },{ wch:28 },{ wch:16 },{ wch:14 },{ wch:16 },{ wch:14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Mijozlar jami');

  const dateRange = `${dateFrom || 'boshidan'}_${dateTo || 'hozir'}`;
  XLSX.writeFile(wb, `barcha_savdolar_${dateRange}.xlsx`);
  toast.success(`Excel yuklab olindi — ${grandSales} ta savdo, ${customers.length} ta mijoz`);
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface DebtWithPayments {
  id: string;
  debtorName: string;
  debtorPhone: string;
  originalAmount: number;
  remainingAmount: number;
  status: string;
  saleId: string;
  payments?: DebtPayment[];
  sale?: { saleNumber: string; grandTotal: number; completedAt?: string };
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// PDF ACTION BUTTONS
// ─────────────────────────────────────────────────────────────
function PdfActionButtons({ pdfUrl, filename }: { pdfUrl: string | null; filename: string }) {
  const [sharing, setSharing] = useState(false);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!pdfUrl) return null;

  const handlePrint = () => {
    const win = window.open(pdfUrl, "_blank");
    if (!win) { toast.error("Popup bloklangan"); return; }
    win.addEventListener("load", () => { win.focus(); win.print(); });
  };

  const handleDownload = async () => {
    try {
      const r = await fetch(pdfUrl);
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(u), 150);
    } catch { toast.error("Yuklab olishda xatolik"); }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const r = await fetch(pdfUrl);
      const b = await r.blob();
      const file = new File([b], filename, { type: "application/pdf" });
      const canShare =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });
      if (canShare) { await navigator.share({ title: filename.replace(".pdf", ""), files: [file] }); return; }
      if (typeof navigator.share === "function") {
        await navigator.share({ title: filename.replace(".pdf", ""), url: window.location.href }); return;
      }
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(u), 150);
      toast.success("PDF yuklandi");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error("Ulashishda xatolik");
    } finally { setSharing(false); }
  };

  return (
    <div className="flex gap-2">
      {!isMobile && (
        <button onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">
          <Printer size={15} /> Chop etish
        </button>
      )}
      <button onClick={handleDownload}
        className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors">
        <Download size={15} /> PDF yuklash
      </button>
      <button onClick={handleShare} disabled={sharing}
        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60">
        {sharing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Share2 size={15} />}
        Ulashish
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function groupSalesByDate(sales: Sale[]): { label: string; date: string; sales: Sale[] }[] {
  const groups = new Map<string, Sale[]>();
  for (const sale of sales) {
    const dateStr = sale.completedAt ? sale.completedAt.slice(0, 10) : sale.createdAt.slice(0, 10);
    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr)!.push(sale);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, salesArr]) => {
      const d = parseISO(date);
      let label = format(d, "dd MMMM yyyy", { locale: uz });
      if (isToday(d)) label = "Bugun";
      else if (isYesterday(d)) label = "Kecha";
      return { label, date, sales: salesArr };
    });
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    PENDING:        { cls: "bg-red-100 text-red-700",     label: "To'lanmagan" },
    PARTIALLY_PAID: { cls: "bg-amber-100 text-amber-700", label: "Qisman" },
    PAID:           { cls: "bg-emerald-100 text-emerald-700", label: "To'langan" },
    CANCELLED:      { cls: "bg-gray-100 text-gray-500",   label: "Bekor" },
  };
  const c = cfg[status] ?? { cls: "bg-gray-100 text-gray-500", label: status };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.cls}`}>{c.label}</span>;
}

// ─────────────────────────────────────────────────────────────
// OVERDUE DEBTS BANNER
// ─────────────────────────────────────────────────────────────
function OverdueDebtsBanner({
  customers, onSelect,
}: { customers: Customer[]; onSelect: (c: Customer) => void }) {
  const [expanded,  setExpanded]  = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const now = new Date();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const overdueCustomers = useMemo(() =>
    customers
      .filter(c => {
        if (Number(c.totalDebt ?? 0) <= 0) return false;
        const d = (c as any).oldestDebtAt ? new Date((c as any).oldestDebtAt) : new Date(c.createdAt);
        return now.getTime() - d.getTime() > THIRTY_DAYS_MS;
      })
      .sort((a, b) => Number(b.totalDebt ?? 0) - Number(a.totalDebt ?? 0)),
  [customers]); // eslint-disable-line react-hooks/exhaustive-deps

  if (overdueCustomers.length === 0 || dismissed) return null;

  const totalOverdue = overdueCustomers.reduce((s, c) => s + Number(c.totalDebt ?? 0), 0);
  const getDays = (c: Customer) => {
    const d = (c as any).oldestDebtAt ? new Date((c as any).oldestDebtAt) : new Date(c.createdAt);
    return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  };

  return (
    <div className="rounded-2xl overflow-hidden border-2 border-orange-300 shadow-md">
      <div
        className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 flex items-center gap-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="flex h-3 w-3 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">⚠️ {overdueCustomers.length} ta mijoz — 30 kundan oshgan qarz</p>
          <p className="text-orange-100 text-xs mt-0.5">Jami: {fmt(totalOverdue)} · Zudlik bilan undirilishi kerak</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setDismissed(true); }}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          >
            <XCircle size={15} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-white/80" /> : <ChevronDown size={16} className="text-white/80" />}
        </div>
      </div>

      {expanded && (
        <div className="bg-orange-50 divide-y divide-orange-100">
          {overdueCustomers.map((c, idx) => {
            const days = getDays(c);
            const cls = days > 90 ? "text-red-700 bg-red-100 border border-red-200"
              : days > 60 ? "text-orange-700 bg-orange-100 border border-orange-200"
              : "text-amber-700 bg-amber-100 border border-amber-200";
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-orange-100/70 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-orange-700">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{c.phone}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-lg font-bold flex-shrink-0 ${cls}`}>{days} kun</span>
                <p className="font-black text-red-600 text-sm flex-shrink-0">{fmt(c.totalDebt)}</p>
                <ChevronRight size={14} className="text-orange-300 flex-shrink-0" />
              </div>
            );
          })}
          <div className="px-4 py-2.5 bg-orange-100/80 flex items-center justify-between">
            <p className="text-xs text-orange-700 font-semibold">{overdueCustomers.length} ta qarzdor (30+ kun)</p>
            <p className="text-xs font-black text-red-600">Jami: {fmt(totalOverdue)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BULK PAY DEBT MODAL (o'zgarishsiz)
// ─────────────────────────────────────────────────────────────
function BulkPayDebtModal({
  activeDebts, totalRemaining, customerName, onClose, onAllPaid,
}: {
  activeDebts: { sale: Sale; debt: any }[];
  totalRemaining: number;
  customerName: string;
  onClose: () => void;
  onAllPaid: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount]   = useState(String(totalRemaining));
  const [method, setMethod]   = useState<"CASH" | "CARD">("CASH");
  const [note,   setNote]     = useState("");
  const [paying, setPaying]   = useState(false);
  const [done,   setDone]     = useState(false);
  const [receiptUrl, setReceiptUrl]           = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt]   = useState(false);
  const [finalRemaining, setFinalRemaining]   = useState(0);
  const [totalPaidOut,   setTotalPaidOut]     = useState(0);
  const [lastDebtId,     setLastDebtId]       = useState<string | null>(null);

  useEffect(() => { return () => { if (receiptUrl) URL.revokeObjectURL(receiptUrl); }; }, [receiptUrl]);

  const handlePay = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Summa kiriting"); return; }
    if (amt > totalRemaining + 0.01) { toast.error("Summa qarzdan oshib ketdi"); return; }

    setPaying(true);
    let leftover = amt;
    let lastId = activeDebts[0]?.debt?.id ?? null;

    for (const { sale, debt } of activeDebts) {
      if (leftover <= 0.005) break;
      const debtRem = Number(debt.remainingAmount);
      const toPay   = Math.min(leftover, debtRem);
      lastId = debt.id;
      try {
        await api.post(`/debts/${debt.id}/payment`, {
          amount: Math.round(toPay * 100) / 100,
          paymentMethod: method,
          note: note || undefined,
        });
        leftover = Math.max(0, leftover - toPay);
      } catch (e: any) {
        toast.error(`#${sale.saleNumber}: ${e?.response?.data?.message ?? "Xatolik"}`);
        break;
      }
    }

    const actualPaid   = Math.round((amt - leftover) * 100) / 100;
    const newRemaining = Math.max(0, Math.round((totalRemaining - actualPaid) * 100) / 100);

    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["customer-sales"] });
    qc.invalidateQueries({ queryKey: ["customer-sales-debts"] });
    qc.invalidateQueries({ queryKey: ["customer-stats"] });

    setTotalPaidOut(actualPaid);
    setFinalRemaining(newRemaining);
    setLastDebtId(lastId);
    setDone(true);
    setPaying(false);
    onAllPaid();

    if (lastId) {
      setLoadingReceipt(true);
      try {
        const params = new URLSearchParams({
          totalOriginal: String(totalRemaining),
          paidAmount: String(actualPaid),
          currentRemaining: String(newRemaining),
          paymentMethod: method,
        });
        const r = await api.get(`/debts/${lastId}/receipt?${params}`, { responseType: "blob" });
        setReceiptUrl(window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" })));
      } catch { toast.error("Chek yuklanmadi"); }
      finally { setLoadingReceipt(false); }
    }
  };

  if (done) {
    const allClear = finalRemaining <= 0.01;
    return (
      <div className="space-y-3">
        <div className={`rounded-xl p-4 flex items-center gap-3 ${allClear ? "bg-emerald-50 border border-emerald-200" : "bg-blue-50 border border-blue-200"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${allClear ? "bg-emerald-100" : "bg-blue-100"}`}>
            <CheckCircle size={20} className={allClear ? "text-emerald-600" : "text-blue-600"} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${allClear ? "text-emerald-800" : "text-blue-800"}`}>
              {allClear ? "Barcha qarzlar to'landi!" : "To'lov amalga oshirildi"}
            </p>
            <p className={`text-xs ${allClear ? "text-emerald-600" : "text-blue-600"}`}>
              {fmt(totalPaidOut)} to'landi · {method === "CASH" ? "Naqd" : "Karta"}
              {!allClear && ` · qoldiq: ${fmt(finalRemaining)}`}
            </p>
          </div>
        </div>
        {loadingReceipt
          ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
          : receiptUrl ? (
            <>
              <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: "50vh" }}>
                <iframe src={receiptUrl} className="w-full h-full" title="Qarz to'lov cheki" />
              </div>
              <PdfActionButtons pdfUrl={receiptUrl} filename={`qarz-chek-${lastDebtId?.slice(0, 8)}.pdf`} />
            </>
          ) : null}
        <button onClick={onClose}
          className="w-full py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
          Yopish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-800 px-3 py-2.5 flex items-center justify-between">
          <p className="text-white font-bold text-xs">FAOL QARZLAR</p>
          <p className="text-gray-300 text-xs">{customerName}</p>
        </div>
        {activeDebts.map(({ sale, debt }, i) => {
          const debtRem  = Math.round(Number(debt.remainingAmount) * 100) / 100;
          const isPartial = debt.status === "PARTIALLY_PAID";
          return (
            <div key={debt.id} className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
              <div>
                <p className="font-semibold text-gray-800 text-xs">#{sale.saleNumber}</p>
                <p className="text-gray-400 text-xs">{sale.completedAt ? format(parseISO(sale.completedAt), "dd.MM.yy") : "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isPartial ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  {isPartial ? "Qisman" : "To'lanmagan"}
                </span>
                <p className={`font-black text-sm ${isPartial ? "text-amber-700" : "text-red-700"}`}>{fmt(debtRem)}</p>
              </div>
            </div>
          );
        })}
        <div className="bg-gray-800 px-3 py-2.5 flex items-center justify-between">
          <p className="text-gray-300 text-xs font-semibold">{activeDebts.length} ta savdo · umumiy qoldiq</p>
          <p className="text-yellow-400 font-black text-base">{fmt(totalRemaining)}</p>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To&apos;lov summasi</label>
        <div className="relative">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            max={totalRemaining} min={0.01} step="0.01"
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 font-semibold text-lg pr-24" />
          <button onClick={() => setAmount(String(totalRemaining))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-semibold hover:bg-indigo-200 transition-colors">
            Hammasi
          </button>
        </div>
        {Number(amount) > totalRemaining + 0.01 && <p className="text-xs text-red-500 mt-1">Summa qarzdan oshib ketdi!</p>}
        {Number(amount) < totalRemaining - 0.01 && Number(amount) > 0 && <p className="text-xs text-amber-600 mt-1">Qisman to&apos;lov — eng qadimiy qarzdan boshlab taqsimlanadi</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To&apos;lov usuli</label>
        <div className="flex gap-2">
          {(["CASH", "CARD"] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${method === m ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {m === "CASH" ? <><Banknote size={15} />Naqd</> : <><CreditCard size={15} />Karta</>}
            </button>
          ))}
        </div>
      </div>
      <Input label="Izoh (ixtiyoriy)" value={note} onChange={e => setNote(e.target.value)} placeholder="Izoh..." />
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Bekor</Button>
        <Button className="flex-1" isLoading={paying} onClick={handlePay}>
          <DollarSign size={15} className="mr-1" />{fmt(Number(amount) || 0)} to&apos;lash
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DEBT LIST MODAL
// ─────────────────────────────────────────────────────────────
function DebtListModal({
  customerId, customerName, customerPhone, onClose,
}: {
  customerId: string; customerName: string; customerPhone: string;
  onClose: () => void;
  onPayDebt: (debtId: string, remaining: number, saleNumber?: string) => void;
}) {
  const { data: salesData, isLoading } = useQuery({
    queryKey:  ["customer-sales-debts", customerId],
    queryFn:   () => customersApi.getSales(customerId, 1, 100),
    staleTime: 3 * 60_000, // ✅ 3 daqiqa
  });

  const salesList = useMemo<Sale[]>(() => {
    if (!salesData) return [];
    if (Array.isArray(salesData)) return salesData;
    if (Array.isArray((salesData as any).data)) return (salesData as any).data;
    return [];
  }, [salesData]);

  const activeDebts = useMemo(() =>
    salesList
      .filter(s => s.debt && (s.debt.status === "PENDING" || s.debt.status === "PARTIALLY_PAID"))
      .map(s => ({ sale: s, debt: s.debt! }))
      .sort((a, b) =>
        new Date(a.sale.completedAt || a.sale.createdAt).getTime() -
        new Date(b.sale.completedAt || b.sale.createdAt).getTime()
      ),
  [salesList]);

  const totalRemaining = Math.round(activeDebts.reduce((s, { debt }) => s + Number(debt.remainingAmount), 0) * 100) / 100;
  const totalDebtTaken = Math.round(activeDebts.reduce((s, { debt }) => s + Number(debt.originalAmount), 0) * 100) / 100;
  const totalPaid      = Math.round((totalDebtTaken - totalRemaining) * 100) / 100;

  const [showBulkPay, setShowBulkPay] = useState(false);
  const [pdfUrl,      setPdfUrl]      = useState<string | null>(null);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => { return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }; }, [pdfUrl]);

  const handleShowPdf = async () => {
    if (activeDebts.length === 0 || pdfUrl) return;
    setPdfLoading(true);
    try {
      const element = tableRef.current;
      if (!element) { toast.error("Jadval topilmadi"); return; }
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF }                = await import("jspdf");
      const canvas  = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW   = pdf.internal.pageSize.getWidth();
      const pageH   = pdf.internal.pageSize.getHeight();
      const margin  = 10;
      const imgW    = pageW - margin * 2;
      const imgH    = (canvas.height * imgW) / canvas.width;
      if (imgH <= pageH - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, margin, imgW, imgH);
      } else {
        let remainH = imgH; let srcY = 0;
        while (remainH > 0) {
          const sliceH  = Math.min(pageH - margin * 2, remainH);
          const sliceC  = document.createElement("canvas");
          sliceC.width  = canvas.width;
          sliceC.height = (sliceH / imgH) * canvas.height;
          const ctx     = sliceC.getContext("2d")!;
          ctx.drawImage(canvas, 0, srcY * (canvas.height / imgH), canvas.width, sliceC.height, 0, 0, canvas.width, sliceC.height);
          if (srcY > 0) pdf.addPage();
          pdf.addImage(sliceC.toDataURL("image/png"), "PNG", margin, margin, imgW, sliceH);
          srcY += sliceH; remainH -= sliceH;
        }
      }
      setPdfUrl(window.URL.createObjectURL(pdf.output("blob")));
    } catch { toast.error("PDF yaratilmadi"); }
    finally { setPdfLoading(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" /></div>;
  if (activeDebts.length === 0) return (
    <div className="text-center py-8 text-gray-400">
      <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400 opacity-60" />
      <p className="text-sm font-medium text-emerald-600">Faol qarzlar yo&apos;q</p>
    </div>
  );

  if (showBulkPay) {
    return (
      <BulkPayDebtModal
        activeDebts={activeDebts} totalRemaining={totalRemaining} customerName={customerName}
        onClose={() => { setShowBulkPay(false); onClose(); }} onAllPaid={() => {}}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div ref={tableRef} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-800 px-4 py-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-bold text-sm">QARZDORLIK FAKTURASI</p>
              <p className="text-gray-300 text-xs mt-0.5">{new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-sm">{customerName}</p>
              <p className="text-gray-300 text-xs mt-0.5">{customerPhone}</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-500 min-w-[180px]">Savdo</th>
                <th className="text-center px-2 py-2 font-semibold text-gray-500 min-w-[80px]">Sana</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-500 min-w-[100px]">Qarz</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-500 min-w-[100px]">Qoldiq</th>
              </tr>
            </thead>
            <tbody>
              {activeDebts.map(({ sale, debt }, sIdx) => {
                const debtRem  = Math.round(Number(debt.remainingAmount) * 100) / 100;
                const isPartial = debt.status === "PARTIALLY_PAID";
                return (
                  <tr key={`row-${debt.id}`} className={`border-b border-gray-100 ${sIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-3 py-2 min-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-800">#{sale.saleNumber}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isPartial ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {isPartial ? "Qisman" : "To'lanmagan"}
                        </span>
                      </div>
                    </td>
                    <td className="text-center px-2 py-2 text-gray-400 text-xs min-w-[80px]">{format(parseISO(sale.completedAt || sale.createdAt), "dd.MM.yy")}</td>
                    <td className="text-right px-3 py-2 text-red-600 font-semibold min-w-[100px]">{fmt(Number(debt.originalAmount))}</td>
                    <td className={`text-right px-3 py-2 font-black min-w-[100px] ${isPartial ? "text-amber-700" : "text-red-700"}`}>{fmt(debtRem)}</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-800">
                <td colSpan={2} className="px-3 py-3 text-white font-bold text-sm">Jami: {activeDebts.length} ta savdo</td>
                <td className="px-3 py-3 text-gray-300 text-right text-xs">
                  {totalPaid > 0 && <span className="text-emerald-400">To&apos;langan: {fmt(totalPaid)}</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  <p className="text-yellow-400 font-black text-base">{fmt(totalRemaining)}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <button onClick={() => setShowBulkPay(true)}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm py-3.5 rounded-xl font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm">
        <DollarSign size={16} />Jami {fmt(totalRemaining)} to&apos;lash
      </button>

      {pdfUrl ? (
        <PdfActionButtons pdfUrl={pdfUrl} filename={`qarz-${customerName}.pdf`} />
      ) : (
        <button onClick={handleShowPdf} disabled={pdfLoading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm py-3 rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60">
          {pdfLoading
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> PDF yuklanmoqda...</>
            : <><FileText size={16} /> PDF ko&apos;rish</>}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAY DEBT MODAL
// ─────────────────────────────────────────────────────────────
function PayDebtModal({ debtId, remaining, saleNumber, onClose, onSuccess }: {
  debtId: string; remaining: number; saleNumber?: string;
  onClose: () => void; onSuccess?: (paymentId: string, paidAmount: number) => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<"CASH" | "CARD">("CASH");
  const [note,   setNote]   = useState("");
  const [paid,   setPaid]   = useState(false);
  const [receiptUrl, setReceiptUrl]             = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt]     = useState(false);
  const [paidAmount, setPaidAmount]             = useState(0);
  const [newRemaining, setNewRemaining]         = useState<number | null>(null);

  useEffect(() => { return () => { if (receiptUrl) URL.revokeObjectURL(receiptUrl); }; }, [receiptUrl]);

  const downloadReceipt = async (id: string, pId?: string) => {
    setLoadingReceipt(true);
    try {
      const params = new URLSearchParams();
      if (pId) params.append("paymentId", pId);
      const res = await api.get(`/debts/${id}/receipt?${params}`, { responseType: "blob" });
      setReceiptUrl(window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" })));
    } catch { toast.error("Chek yuklanmadi"); }
    finally { setLoadingReceipt(false); }
  };

  const mutation = useMutation({
    mutationFn: () => api.post(`/debts/${debtId}/payment`, { amount: Number(amount), paymentMethod: method, note: note || undefined }),
    onSuccess: (res) => {
      toast.success("To'lov amalga oshirildi!");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-sales"] });
      qc.invalidateQueries({ queryKey: ["customer-sales-debts"] });
      qc.invalidateQueries({ queryKey: ["customer-stats"] });
      const paidAmt = Number(amount);
      setPaidAmount(paidAmt);
      const pId = res.data?.payments?.[0]?.id;
      setNewRemaining(Number(res.data?.remainingAmount ?? 0));
      if (onSuccess) onSuccess(pId, paidAmt);
      setPaid(true);
      downloadReceipt(debtId, pId);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Xatolik yuz berdi"),
  });

  if (paid) return (
    <div className="space-y-3">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle size={20} className="text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-emerald-800 text-sm">To&apos;lov muvaffaqiyatli!</p>
          <p className="text-xs text-emerald-600">{fmt(paidAmount)} to&apos;landi · {method === "CASH" ? "Naqd" : "Karta"}</p>
        </div>
      </div>
      {newRemaining !== null && (
        <div className={`rounded-xl p-3 flex items-center justify-between ${newRemaining <= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
          <span className={`text-sm font-semibold ${newRemaining <= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {newRemaining <= 0 ? "✓ Qarz to'liq yopildi" : "Qolgan qoldiq:"}
          </span>
          {newRemaining > 0 && <span className="font-black text-red-700 text-lg">{fmt(newRemaining)}</span>}
        </div>
      )}
      {loadingReceipt
        ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        : receiptUrl ? (
          <>
            <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: "50vh" }}>
              <iframe src={receiptUrl} className="w-full h-full" title="Qarz to'lov cheki" />
            </div>
            <PdfActionButtons pdfUrl={receiptUrl} filename={`qarz-chek-${debtId.slice(0, 8)}.pdf`} />
          </>
        ) : null}
      <button onClick={onClose}
        className="w-full py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
        Yopish
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {saleNumber && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
          <p className="text-xs text-blue-600">Savdo: <span className="font-bold text-blue-800">#{saleNumber}</span></p>
        </div>
      )}
      <div className="bg-red-50 border border-red-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-red-700 mb-1">Qarz summasi</p>
        <p className="text-2xl font-bold text-red-600">{fmt(remaining)}</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To&apos;lov summasi</label>
        <div className="relative">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} max={remaining} min={0.01} step="0.01"
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 font-semibold text-lg pr-16" />
          <button onClick={() => setAmount(String(remaining))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-semibold hover:bg-indigo-200 transition-colors">
            Hammasi
          </button>
        </div>
        {Number(amount) > remaining && <p className="text-xs text-red-500 mt-1">Summa qarzdan oshib ketdi!</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To&apos;lov usuli</label>
        <div className="flex gap-2">
          {(["CASH", "CARD"] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${method === m ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {m === "CASH" ? <><Banknote size={15} />Naqd</> : <><CreditCard size={15} />Karta</>}
            </button>
          ))}
        </div>
      </div>
      <Input label="Izoh (ixtiyoriy)" value={note} onChange={e => setNote(e.target.value)} placeholder="Izoh..." />
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Bekor</Button>
        <Button className="flex-1" isLoading={mutation.isPending} onClick={() => {
          const amt = Number(amount);
          if (!amount || amt <= 0) { toast.error("Summa kiriting"); return; }
          if (amt > remaining + 0.01) { toast.error("Summa qarzdan oshib ketdi"); return; }
          mutation.mutate();
        }}>To&apos;lash</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DEBT PAYMENTS HISTORY MODAL
// ─────────────────────────────────────────────────────────────
function DebtPaymentsHistoryModal({ debtId, originalAmount, onClose, onPayDebt }: {
  debtId: string; originalAmount: number; onClose: () => void; onPayDebt: () => void;
}) {
  const { data: debt, isLoading } = useQuery<DebtWithPayments>({
    queryKey:  ["debt-detail", debtId],
    queryFn:   () => api.get(`/debts/${debtId}`).then(r => r.data),
    staleTime: 2 * 60_000, // ✅ 2 daqiqa
  });
  const [receiptUrl,       setReceiptUrl]       = useState<string | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  useEffect(() => { return () => { if (receiptUrl) URL.revokeObjectURL(receiptUrl); }; }, [receiptUrl]);

  const handleViewReceipt = async (paymentId: string) => {
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
    setReceiptUrl(null);
    setLoadingReceiptId(paymentId);
    try {
      const res = await api.get(`/debts/${debtId}/receipt?paymentId=${paymentId}`, { responseType: "blob" });
      setReceiptUrl(window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" })));
    } catch { toast.error("Chek yuklanmadi"); }
    finally { setLoadingReceiptId(null); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  if (!debt) return null;

  const payments  = debt.payments ?? [];
  const isPending = debt.status === "PENDING" || debt.status === "PARTIALLY_PAID";

  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-4 ${debt.status === "PAID" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-xs font-semibold ${debt.status === "PAID" ? "text-emerald-600" : "text-red-600"}`}>Dastlabki qarz</p>
            <p className={`text-lg font-bold ${debt.status === "PAID" ? "text-emerald-800" : "text-red-800"}`}>{fmt(originalAmount)}</p>
          </div>
          <div className="text-right">
            <p className={`text-xs font-semibold ${debt.status === "PAID" ? "text-emerald-600" : "text-red-600"}`}>Qolgan qarz</p>
            <p className={`text-lg font-bold ${debt.status === "PAID" ? "text-emerald-700" : "text-red-700"}`}>{fmt(debt.remainingAmount)}</p>
          </div>
        </div>
        <div className="mt-2"><StatusBadge status={debt.status} /></div>
      </div>

      {payments.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <Receipt size={13} className="text-indigo-500" /> To&apos;lovlar tarixi ({payments.length} ta)
          </p>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      {p.paymentMethod === "CASH" ? <Banknote size={13} className="text-emerald-600" /> : <CreditCard size={13} className="text-blue-600" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{fmt(p.amount)}</p>
                      <p className="text-xs text-gray-400">{p.paymentMethod === "CASH" ? "Naqd" : "Karta"} · {format(parseISO(p.createdAt), "dd.MM.yyyy HH:mm")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">→ <span className="font-semibold text-red-600">{fmt(p.remainingAfter)}</span></span>
                    <button onClick={() => handleViewReceipt(p.id)} disabled={loadingReceiptId === p.id}
                      className="text-xs text-indigo-600 font-semibold p-1.5 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-60 flex items-center gap-1">
                      {loadingReceiptId === p.id ? <div className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin" /> : <FileText size={13} />}
                    </button>
                  </div>
                </div>
                {p.note && <p className="text-xs text-gray-400 mt-1.5 pl-9 italic">{p.note}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400">
          <Clock size={24} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Hali to&apos;lov amalga oshirilmagan</p>
        </div>
      )}

      {receiptUrl && (
        <div>
          <div className="rounded-xl overflow-hidden border border-gray-100 mt-2" style={{ height: "50vh" }}>
            <iframe src={receiptUrl} className="w-full h-full" title="To'lov cheki" />
          </div>
          <div className="mt-2"><PdfActionButtons pdfUrl={receiptUrl} filename={`qarz-chek-${debtId.slice(0, 8)}.pdf`} /></div>
          <button onClick={() => { URL.revokeObjectURL(receiptUrl); setReceiptUrl(null); }}
            className="w-full mt-2 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors">
            Chekni yopish
          </button>
        </div>
      )}

      {isPending && (
        <button onClick={() => { onClose(); onPayDebt(); }}
          className="w-full bg-emerald-600 text-white text-sm py-3 rounded-xl font-bold hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2">
          <DollarSign size={15} /> To&apos;lash — {fmt(debt.remainingAmount)}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RETURN MODAL
// ─────────────────────────────────────────────────────────────
function ReturnModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const qc = useQueryClient();
  const [quantities,    setQuantities]   = useState<Record<string, string>>(
    Object.fromEntries(sale.items.map(i => [i.id, "0"]))
  );
  const [reason,        setReason]       = useState("");
  const [done,          setDone]         = useState(false);
  const [returnResult,  setReturnResult] = useState<SaleReturn | null>(null);
  const [receiptUrl,    setReceiptUrl]   = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => { return () => { if (receiptUrl) URL.revokeObjectURL(receiptUrl); }; }, [receiptUrl]);

  const selectedItems  = sale.items.map(item => ({ item, qty: parseFloat(quantities[item.id] || "0") })).filter(({ qty }) => qty > 0);
  const totalRefund    = selectedItems.reduce((s, { item, qty }) => s + qty * item.customUnitPrice, 0);

  const downloadReceipt = async (returnId: string) => {
    setLoadingReceipt(true);
    try {
      const blob = await customersApi.getReturnReceipt(returnId);
      setReceiptUrl(window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" })));
    } catch { toast.error("Chek yuklanmadi"); }
    finally { setLoadingReceipt(false); }
  };

  const mutation = useMutation({
    mutationFn: () => customersApi.createReturn({
      originalSaleId: sale.id,
      reason: reason || undefined,
      items: selectedItems.map(({ item, qty }) => ({ saleItemId: item.id, quantity: qty, reason: reason || undefined })),
    }),
    onSuccess: async result => {
      toast.success("Qaytarish so'rovi yaratildi");
      qc.invalidateQueries({ queryKey: ["customer-sales"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setReturnResult(result);
      setDone(true);
      await downloadReceipt(result.id);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Xatolik yuz berdi"),
  });

  if (done) return (
    <div className="space-y-3">
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          <RotateCcw size={18} className="text-purple-600" />
        </div>
        <div>
          <p className="font-semibold text-purple-800 text-sm">Qaytarish yaratildi!</p>
          <p className="text-xs text-purple-600">#{returnResult?.returnNumber} · Admin tasdiqlashini kuting</p>
        </div>
      </div>
      {loadingReceipt
        ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
        : receiptUrl ? (
          <>
            <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: "50vh" }}>
              <iframe src={receiptUrl} className="w-full h-full" title="Qaytarish cheki" />
            </div>
            <PdfActionButtons pdfUrl={receiptUrl} filename={`return-${returnResult?.returnNumber}.pdf`} />
          </>
        ) : null}
      <button onClick={onClose}
        className="w-full py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
        Yopish
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 flex items-center justify-between">
        <span>Savdo: <span className="font-semibold">#{sale.saleNumber}</span></span>
        <span>Jami: <span className="font-semibold text-indigo-700">{fmt(sale.grandTotal)}</span></span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sale.items.map(item => {
          const qty = parseFloat(quantities[item.id] || "0");
          const max = item.quantity;
          return (
            <div key={item.id} className={`rounded-xl border p-3 transition-all ${qty > 0 ? "border-purple-300 bg-purple-50/40" : "border-gray-100 bg-white"}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">{item.productNameSnapshot}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(item.customUnitPrice)} · Jami: {item.quantity} {item.unitSnapshot}</p>
                </div>
                {qty > 0 && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">-{fmt(qty * item.customUnitPrice)}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 flex-shrink-0">Qaytarish:</span>
                <button onClick={() => { const cur = parseFloat(quantities[item.id] || "0"); if (cur > 0) setQuantities(p => ({ ...p, [item.id]: String(cur - 1) })); }}
                  className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors">−</button>
                <input type="number" min={0} max={max} step="any" value={quantities[item.id]}
                  onChange={e => {
                    const val = e.target.value;
                    const num = parseFloat(val);
                    if (val === "" || val === "0") { setQuantities(p => ({ ...p, [item.id]: val })); return; }
                    if (!isNaN(num) && num >= 0 && num <= max) setQuantities(p => ({ ...p, [item.id]: val }));
                  }}
                  className="w-14 text-center text-xs border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-purple-400 font-bold" />
                <button onClick={() => { const cur = parseFloat(quantities[item.id] || "0"); if (cur < max) setQuantities(p => ({ ...p, [item.id]: String(cur + 1) })); }}
                  className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors">+</button>
                <span className="text-xs text-gray-400">/ {max}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Qaytarish sababi</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Masalan: mahsulot nuqsonli..." rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
      </div>
      {totalRefund > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex justify-between items-center">
          <span className="text-sm text-purple-700 font-medium">Qaytariladigan summa:</span>
          <span className="text-lg font-bold text-purple-700">{fmt(totalRefund)}</span>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Bekor</Button>
        <Button className="flex-1 !bg-purple-600 hover:!bg-purple-700" isLoading={mutation.isPending}
          disabled={selectedItems.length === 0}
          onClick={() => { if (selectedItems.length === 0) { toast.error("Kamida 1 ta mahsulot tanlang"); return; } mutation.mutate(); }}>
          Qaytarishni yuborish
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CUSTOMER FORM MODAL
// ─────────────────────────────────────────────────────────────
function CustomerFormModal({ customer, onClose }: { customer?: Customer | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name,  setName]  = useState(customer?.name  ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");

  const mutation = useMutation({
    mutationFn: () => customer
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
      <Input label="To'liq ism *" value={name}
        onChange={e => setName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
        placeholder="Mijoz ismi" />
      <Input label="Telefon raqami *" value={phone} type="tel"
        onChange={e => {
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
        placeholder="+998 90 123 45 67" />
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Izoh</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Qo'shimcha ma'lumot..." rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Bekor</Button>
        <Button className="flex-1" isLoading={mutation.isPending}
          onClick={() => {
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

// ─────────────────────────────────────────────────────────────
// SALE RECEIPT MODAL
// ─────────────────────────────────────────────────────────────
function SaleReceiptModal({ saleId, saleNumber }: { saleId: string; saleNumber: string; onClose: () => void }) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    api.get(`/sales/${saleId}/receipt`, { responseType: "blob" })
      .then(res => {
        objectUrl = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        setReceiptUrl(objectUrl);
      })
      .catch(() => toast.error("Chek yuklanmadi"))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) window.URL.revokeObjectURL(objectUrl); };
  }, [saleId]);

  return (
    <div className="space-y-3">
      {loading
        ? <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        : receiptUrl
          ? <>
            <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: "60vh" }}>
              <iframe src={receiptUrl} className="w-full h-full" title={`Chek #${saleNumber}`} />
            </div>
            <PdfActionButtons pdfUrl={receiptUrl} filename={`chek-${saleNumber}.pdf`} />
          </>
          : <p className="text-center text-gray-400 py-8">Chek topilmadi</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DEBT RECEIPT CARD
// ─────────────────────────────────────────────────────────────
function DebtReceiptCard({ payment, debtId, saleNumber }: {
  payment: DebtPayment; debtId: string; saleNumber: string;
}) {
  const [expanded,   setExpanded]   = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => { return () => { if (receiptUrl) URL.revokeObjectURL(receiptUrl); }; }, [receiptUrl]);

  const loadReceipt = async () => {
    if (receiptUrl) return;
    setLoading(true);
    try {
      const res = await api.get(`/debts/${debtId}/receipt?paymentId=${payment.id}`, { responseType: "blob" });
      setReceiptUrl(window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" })));
    } catch { toast.error("Chek yuklanmadi"); }
    finally { setLoading(false); }
  };

  const handleToggle = () => {
    setExpanded(!expanded);
    if (!expanded && !receiptUrl) loadReceipt();
  };

  return (
    <div className="rounded-xl overflow-hidden border-2 border-blue-200 bg-blue-50/30">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={handleToggle}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100">
          <Receipt size={16} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">#{saleNumber}</p>
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-semibold">Qarz to&apos;lovi</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${payment.paymentMethod === "CASH" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}>
              {payment.paymentMethod === "CASH" ? "Naqd" : "Karta"}
            </span>
          </div>
          <p className="text-xs text-gray-400">{format(parseISO(payment.createdAt), "HH:mm")}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-sm text-blue-700">{fmt(payment.amount)}</p>
          <p className="text-xs text-gray-400">qoldiq: {fmt(payment.remainingAfter)}</p>
        </div>
        {expanded ? <ChevronUp size={15} className="text-gray-300 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-300 flex-shrink-0" />}
      </div>
      {expanded && (
        <div className="border-t border-blue-100 px-4 py-3 space-y-3 bg-white/80">
          {loading
            ? <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
            : receiptUrl
              ? <>
                <div className="rounded-xl overflow-hidden border border-gray-100" style={{ height: "40vh" }}>
                  <iframe src={receiptUrl} className="w-full h-full" title="Qarz to'lov cheki" />
                </div>
                <PdfActionButtons pdfUrl={receiptUrl} filename={`qarz-chek-${payment.id.slice(0, 8)}.pdf`} />
              </>
              : null}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SALE CARD
// ─────────────────────────────────────────────────────────────
function SaleCard({ sale, onPayDebt, onViewReceipt, onReturn, onViewDebtPayments }: {
  sale: Sale;
  onPayDebt: (debtId: string, remaining: number, saleNumber?: string) => void;
  onViewReceipt: (saleId: string, saleNumber: string) => void;
  onReturn: (sale: Sale) => void;
  onViewDebtPayments: (debtId: string, originalAmount: number, onPayCallback: () => void) => void;
}) {
  const [expanded,   setExpanded]   = useState(false);
  const hasDebt      = sale.debt && sale.debt.remainingAmount > 0;
  const isDebtSale   = sale.payments?.some(p => p.method === "DEBT");
  const hasReturns   = sale.returns && sale.returns.length > 0;
  const isReturned   = sale.status === "RETURNED";
  const isDebtPaid   = isDebtSale && sale.debt?.status === "PAID";

  return (
    <div className={`rounded-xl overflow-hidden border-2 transition-all ${hasDebt ? "border-red-200 bg-red-50/30" : isDebtPaid ? "border-emerald-200 bg-emerald-50/20" : isReturned ? "border-purple-200 bg-purple-50/20" : "border-gray-100 bg-white"}`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${hasDebt ? "bg-red-100" : isDebtPaid ? "bg-emerald-100" : isReturned ? "bg-purple-100" : "bg-indigo-50"}`}>
          {isReturned
            ? <RotateCcw size={16} className="text-purple-500" />
            : <ShoppingBag size={16} className={hasDebt ? "text-red-500" : isDebtPaid ? "text-emerald-500" : "text-indigo-500"} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">#{sale.saleNumber}</p>
            {hasDebt     && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-semibold">Nasiya</span>}
            {isDebtPaid  && <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-md font-semibold">To&apos;landi</span>}
            {isReturned  && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md font-semibold">Qaytarildi</span>}
            {hasReturns && !isReturned && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md font-semibold">Qisman qaytarildi</span>}
          </div>
          <p className="text-xs text-gray-400">{sale.completedAt ? format(parseISO(sale.completedAt), "HH:mm") : "—"}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-sm text-gray-900">{fmt(sale.grandTotal)}</p>
          {hasDebt     && <p className="text-xs text-red-500 font-semibold">{fmt(sale.debt!.remainingAmount)} qarz</p>}
          {isDebtPaid  && <p className="text-xs text-emerald-600 font-semibold">✓ To&apos;liq</p>}
        </div>
        {expanded ? <ChevronUp size={15} className="text-gray-300 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-300 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-white/80">
          <div className="space-y-1.5">
            {sale.items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between">
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
              <span key={p.id} className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${p.method === "CASH" ? "bg-emerald-100 text-emerald-700" : p.method === "CARD" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                {p.method === "CASH" ? <Banknote size={11} /> : p.method === "CARD" ? <CreditCard size={11} /> : <AlertCircle size={11} />}
                {p.method === "CASH" ? "Naqd" : p.method === "CARD" ? "Karta" : "Nasiya"}: {fmt(p.amount)}
              </span>
            ))}
          </div>
          {sale.debt && (
            <div>
              {(sale.debt.status === "PENDING" || sale.debt.status === "PARTIALLY_PAID") && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-red-700">Qarz: {fmt(sale.debt.remainingAmount)}</p>
                      <StatusBadge status={sale.debt.status} />
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => onViewDebtPayments(sale.debt!.id, sale.debt!.originalAmount, () => onPayDebt(sale.debt!.id, sale.debt!.remainingAmount, sale.saleNumber))}
                        className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-2 rounded-lg font-semibold hover:bg-indigo-200 transition-colors flex items-center gap-1">
                        <Receipt size={12} /> Tarix
                      </button>
                      <button onClick={() => onPayDebt(sale.debt!.id, sale.debt!.remainingAmount, sale.saleNumber)}
                        className="bg-emerald-600 text-white text-xs px-3 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1">
                        <DollarSign size={12} /> To&apos;lash
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {sale.debt.status === "PAID" && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-500" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-700">Qarz to&apos;liq to&apos;landi</p>
                      <p className="text-xs text-emerald-500">{fmt(sale.debt.originalAmount)}</p>
                    </div>
                  </div>
                  <button onClick={() => onViewDebtPayments(sale.debt!.id, sale.debt!.originalAmount, () => {})}
                    className="text-xs text-emerald-700 bg-emerald-100 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-emerald-200 transition-colors flex items-center gap-1">
                    <Receipt size={12} /> Cheklar
                  </button>
                </div>
              )}
            </div>
          )}
          {hasReturns && (
            <div className="space-y-1.5">
              {sale.returns!.map(ret => (
                <div key={ret.id} className={`rounded-lg px-3 py-2 flex items-center justify-between text-xs ${ret.status === "APPROVED" ? "bg-purple-50 border border-purple-100" : ret.status === "PENDING" ? "bg-amber-50 border border-amber-100" : "bg-gray-50 border border-gray-100"}`}>
                  <div className="flex items-center gap-1.5">
                    <RotateCcw size={11} className={ret.status === "APPROVED" ? "text-purple-500" : ret.status === "PENDING" ? "text-amber-500" : "text-gray-400"} />
                    <span className="font-semibold text-gray-700">#{ret.returnNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded-full font-semibold ${ret.status === "APPROVED" ? "bg-purple-100 text-purple-700" : ret.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                      {ret.status === "APPROVED" ? "Tasdiqlandi" : ret.status === "PENDING" ? "Kutilmoqda" : "Rad etildi"}
                    </span>
                  </div>
                  <span className={`font-bold ${ret.status === "APPROVED" ? "text-purple-700" : "text-gray-500"}`}>-{fmt(ret.refundAmount)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            {sale.status === "COMPLETED" && (
              <button onClick={() => onReturn(sale)}
                className="flex-1 flex items-center justify-center gap-2 text-xs text-purple-600 font-semibold py-2 rounded-lg hover:bg-purple-50 transition-colors border border-purple-100">
                <RotateCcw size={13} /> Qaytarish
              </button>
            )}
            <button onClick={() => onViewReceipt(sale.id, sale.saleNumber)}
              className="flex-1 flex items-center justify-center gap-2 text-xs text-indigo-600 font-semibold py-2 rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-100">
              <FileText size={13} /> Chekni ko&apos;rish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CUSTOMER DETAIL — WITH EXCEL EXPORT
// ─────────────────────────────────────────────────────────────
function CustomerDetail({
  customer, onBack, onEdit, onDelete,
}: {
  customer: Customer; onBack: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [tab,           setTab]           = useState<"sales" | "stats">("sales");
  const [payingDebt,    setPayingDebt]    = useState<{ id: string; remaining: number; saleNumber?: string } | null>(null);
  const [viewingReceipt,setViewingReceipt]= useState<{ id: string; number: string } | null>(null);
  const [returningItem, setReturningItem] = useState<Sale | null>(null);
  const [showDebtList,  setShowDebtList]  = useState(false);
  const [debtPaymentsModal, setDebtPaymentsModal] = useState<{ debtId: string; originalAmount: number; onPayCallback: () => void } | null>(null);
  const [salesPage,     setSalesPage]     = useState(1);
  const [isExporting,   setIsExporting]   = useState(false);

  // ✅ Sana filteri — Excel export uchun
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo,   setExportDateTo]   = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["customer-sales", customer.id, salesPage],
    queryFn:  () => customersApi.getSales(customer.id, salesPage),
    enabled:  tab === "sales",
    staleTime: 3 * 60_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey:  ["customer-stats", customer.id],
    queryFn:   () => customersApi.getStats(customer.id),
    staleTime: 3 * 60_000,
  });

  const salesList = useMemo<Sale[]>(() => {
    if (!salesData) return [];
    if (Array.isArray(salesData)) return salesData;
    if (Array.isArray((salesData as any).data)) return (salesData as any).data;
    return [];
  }, [salesData]);

  const salesTotal = useMemo<number>(() => {
    if (!salesData) return 0;
    if (Array.isArray(salesData)) return salesData.length;
    return (salesData as any).total ?? 0;
  }, [salesData]);

  const grouped = useMemo(() => groupSalesByDate(salesList), [salesList]);

  const handleViewDebtPayments = useCallback((debtId: string, originalAmount: number, onPayCallback: () => void) => {
    setDebtPaymentsModal({ debtId, originalAmount, onPayCallback });
  }, []);

  // ── Excel export handlers ────────────────────────────────
  const handleExportSales = useCallback(async () => {
    setIsExporting(true);
    try {
      const res = await customersApi.getSales(customer.id, 1, 9999);
      const all: Sale[] = Array.isArray(res) ? res :
        Array.isArray((res as any).data) ? (res as any).data : salesList;
      // ✅ Sana filterlari uzatiladi
      exportCustomerSalesExcel(
        customer, all,
        exportDateFrom || undefined,
        exportDateTo   || undefined,
      );
      setShowDateFilter(false);
    } catch { toast.error("Yuklab olishda xatolik"); }
    finally { setIsExporting(false); }
  }, [customer, salesList, exportDateFrom, exportDateTo]);

  const handleExportStats = useCallback(async () => {
    if (!stats) { toast.error("Statistika yuklanmagan"); return; }
    setIsExporting(true);
    try {
      exportCustomerStatsExcel(customer, stats);
    } catch { toast.error("Yuklab olishda xatolik"); }
    finally { setIsExporting(false); }
  }, [customer, stats]);

  const MONTHS = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];

  return (
    <div className="space-y-4">
      {/* ── Sarlavha ── */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-lg truncate">{customer.name}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-1"><Phone size={12} />{customer.phone}</p>
        </div>
        <button onClick={onEdit}   className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><Edit2   size={18} className="text-gray-500" /></button>
        <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-xl transition-colors"><Trash2  size={18} className="text-red-400"   /></button>
      </div>

      {/* ── Stats cards ── */}
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
          <button
            onClick={() => stats.totalDebt > 0 && setShowDebtList(true)}
            className={`rounded-xl p-3 text-center transition-all ${stats.totalDebt > 0 ? "bg-red-50 hover:bg-red-100 cursor-pointer active:scale-95" : "bg-gray-50 cursor-default"}`}
          >
            <p className={`text-xs font-medium ${stats.totalDebt > 0 ? "text-red-400" : "text-gray-400"}`}>Qarz</p>
            <p className={`font-bold text-sm ${stats.totalDebt > 0 ? "text-red-700" : "text-gray-500"}`}>{fmt(stats.totalDebt)}</p>
            {stats.totalDebt > 0 && <p className="text-xs text-red-400 mt-0.5">ko&apos;rish →</p>}
          </button>
        </div>
      )}

      {customer.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
          <span className="font-semibold">Izoh: </span>{customer.notes}
        </div>
      )}

      {/* ── Tab ── */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {[{ k: "sales", label: "Savdolar", icon: ShoppingBag }, { k: "stats", label: "Statistika", icon: BarChart2 }].map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${tab === k ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── SAVDOLAR TAB ── */}
      {tab === "sales" && (
        <div className="space-y-4">
          {/* Excel tugmasi */}
          {salesList.length > 0 && (
            <div className="space-y-2">
              {/* Sana filter + Excel tugmasi */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setShowDateFilter(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:border-indigo-300 rounded-xl text-xs font-semibold transition-all"
                >
                  <Calendar size={13} />
                  {exportDateFrom || exportDateTo
                    ? `${exportDateFrom || '...'} – ${exportDateTo || '...'}`
                    : 'Sana filteri'}
                </button>
                <button onClick={handleExportSales} disabled={isExporting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition-all">
                  {isExporting
                    ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Download size={13} />}
                  Savdolarni Excel ga
                </button>
              </div>

              {/* Sana tanlash paneli */}
              {showDateFilter && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[130px]">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Dan (boshlanish)</label>
                    <input
                      type="date"
                      value={exportDateFrom}
                      onChange={e => setExportDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="flex-1 min-w-[130px]">
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Gacha (tugash)</label>
                    <input
                      type="date"
                      value={exportDateTo}
                      onChange={e => setExportDateTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <button
                    onClick={() => { setExportDateFrom(''); setExportDateTo(''); setShowDateFilter(false); }}
                    className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
                  >
                    Tozalash
                  </button>
                </div>
              )}
            </div>
          )}

          {salesLoading
            ? <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
            : grouped.length === 0
              ? <div className="text-center py-10 text-gray-400"><ShoppingBag size={36} className="mx-auto mb-2 opacity-20" /><p className="text-sm">Savdo tarixi yo&apos;q</p></div>
              : (
                <>
                  {grouped.map(group => (
                    <div key={group.date}>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar size={13} className="text-gray-400" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.label}</span>
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-xs text-gray-400">{group.sales.length} ta</span>
                      </div>
                      <div className="space-y-2">
                        {group.sales.map(sale => (
                          <div key={sale.id}>
                            <SaleCard
                              sale={sale}
                              onPayDebt={(id, remaining, saleNum) => setPayingDebt({ id, remaining, saleNumber: saleNum })}
                              onViewReceipt={(id, number) => setViewingReceipt({ id, number })}
                              onReturn={s => setReturningItem(s)}
                              onViewDebtPayments={handleViewDebtPayments}
                            />
                            {sale.debt?.payments && sale.debt.payments.length > 0 && (
                              <div className="mt-1.5 ml-3 space-y-1.5 border-l-2 border-blue-200 pl-3">
                                {sale.debt.payments
                                  .sort((a: DebtPayment, b: DebtPayment) =>
                                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                                  )
                                  .map((payment: DebtPayment) => (
                                    <DebtReceiptCard key={payment.id} payment={payment} debtId={sale.debt!.id} saleNumber={sale.saleNumber} />
                                  ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {salesTotal > 20 && (
                    <div className="flex items-center justify-between pt-2">
                      <Button variant="outline" size="sm" onClick={() => setSalesPage(p => Math.max(1, p - 1))} disabled={salesPage === 1}>Oldingi</Button>
                      <span className="text-sm text-gray-500">{salesPage} / {Math.ceil(salesTotal / 20)}</span>
                      <Button variant="outline" size="sm" onClick={() => setSalesPage(p => p + 1)} disabled={salesPage >= Math.ceil(salesTotal / 20)}>Keyingi</Button>
                    </div>
                  )}
                </>
              )}
        </div>
      )}

      {/* ── STATISTIKA TAB ── */}
      {tab === "stats" && (
        <div className="space-y-3">
          {statsLoading
            ? <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
            : stats ? (
              <>
                {/* Excel tugmasi */}
                <div className="flex justify-end">
                  <button onClick={handleExportStats} disabled={isExporting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition-all">
                    {isExporting
                      ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Download size={13} />}
                    Statistika Excel ga
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-gray-100 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">O&apos;rtacha buyurtma</p>
                    <p className="font-bold text-gray-900">{fmt(stats.averageOrderValue)}</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Ro&apos;yxatga olingan</p>
                    <p className="font-bold text-gray-900">{format(parseISO(customer.createdAt), "dd.MM.yyyy")}</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <TrendingUp size={16} className="text-indigo-500" /> Oylik statistika
                  </p>
                  {Object.keys(stats.monthlyStats).length === 0
                    ? <p className="text-sm text-gray-400 text-center py-4">Ma&apos;lumot yo&apos;q</p>
                    : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {Object.entries(stats.monthlyStats)
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .slice(0, 12)
                          .map(([key, val]) => {
                            const [year, month] = key.split("-");
                            return (
                              <div key={key} className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 w-16 flex-shrink-0">{MONTHS[parseInt(month) - 1]} {year}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                  <div className="bg-indigo-500 h-full rounded-full transition-all"
                                    style={{ width: `${Math.min(100, ((val as any).amount / (stats.totalAmount || 1)) * 100 * 3)}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-gray-700 w-20 text-right flex-shrink-0">{fmt((val as any).amount)}</span>
                                <span className="text-xs text-gray-400 w-8 flex-shrink-0">{(val as any).count}ta</span>
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

      {/* ── Modals ── */}
      <Modal isOpen={showDebtList} onClose={() => setShowDebtList(false)} title="Faol qarzlar" size="sm">
        <DebtListModal customerId={customer.id} customerName={customer.name} customerPhone={customer.phone}
          onClose={() => setShowDebtList(false)}
          onPayDebt={(id, remaining, saleNum) => { setShowDebtList(false); setPayingDebt({ id, remaining, saleNumber: saleNum }); }} />
      </Modal>
      <Modal isOpen={!!payingDebt} onClose={() => setPayingDebt(null)} title={`Qarz to'lovi${payingDebt?.saleNumber ? ` — #${payingDebt.saleNumber}` : ""}`} size="sm">
        {payingDebt && <PayDebtModal debtId={payingDebt.id} remaining={payingDebt.remaining} saleNumber={payingDebt.saleNumber} onClose={() => setPayingDebt(null)} />}
      </Modal>
      <Modal isOpen={!!debtPaymentsModal} onClose={() => setDebtPaymentsModal(null)} title="Qarz to'lovlar tarixi" size="sm">
        {debtPaymentsModal && (
          <DebtPaymentsHistoryModal debtId={debtPaymentsModal.debtId} originalAmount={debtPaymentsModal.originalAmount}
            onClose={() => setDebtPaymentsModal(null)}
            onPayDebt={() => { const cb = debtPaymentsModal.onPayCallback; setDebtPaymentsModal(null); cb(); }} />
        )}
      </Modal>
      <Modal isOpen={!!viewingReceipt} onClose={() => setViewingReceipt(null)} title={`Chek #${viewingReceipt?.number}`} size="md">
        {viewingReceipt && <SaleReceiptModal saleId={viewingReceipt.id} saleNumber={viewingReceipt.number} onClose={() => setViewingReceipt(null)} />}
      </Modal>
      <Modal isOpen={!!returningItem} onClose={() => setReturningItem(null)} title={"Qaytarish — #" + (returningItem?.saleNumber ?? "")} size="md">
        {returningItem && <ReturnModal sale={returningItem} onClose={() => setReturningItem(null)} />}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN CUSTOMERS PAGE
// ─────────────────────────────────────────────────────────────
export function CustomersPage() {
  const qc = useQueryClient();
  const [search,       setSearch]       = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "debt" | "paid">("all");
  const [selected,     setSelected]     = useState<Customer | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [editTarget,   setEditTarget]   = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [isExporting,  setIsExporting]  = useState(false);

  // Barcha mijozlar savdolari sana filteri
  const [showAllSalesFilter, setShowAllSalesFilter] = useState(false);
  const [allSalesDateFrom,   setAllSalesDateFrom]   = useState('');
  const [allSalesDateTo,     setAllSalesDateTo]     = useState('');

  // ✅ debounce — har harf kiritishda so'rov KETMAYDI
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // ✅ queryKey da debouncedSearch ishlatiladi
  const { data: customersRaw, isLoading } = useQuery({
    queryKey: ["customers", debouncedSearch],
    queryFn:  () => customersApi.getAll(debouncedSearch || undefined),
    staleTime: 5 * 60_000,
  });

  const customers = useMemo<Customer[]>(() => {
    if (!customersRaw) return [];
    if (Array.isArray(customersRaw)) return customersRaw;
    if (Array.isArray((customersRaw as any).data)) return (customersRaw as any).data;
    return [];
  }, [customersRaw]);

  const totalDebt    = useMemo(() => customers.reduce((s, c) => s + Number(c.totalDebt ?? 0), 0), [customers]);
  const debtorCount  = useMemo(() => customers.filter(c => Number(c.totalDebt ?? 0) > 0).length, [customers]);

  const filteredCustomers = useMemo<Customer[]>(() => {
    switch (activeFilter) {
      case "debt": return customers.filter(c => Number(c.totalDebt ?? 0) > 0);
      case "paid": return customers.filter(c => Number(c.totalDebt ?? 0) <= 0);
      default:     return customers;
    }
  }, [customers, activeFilter]);

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

  // ── Excel export handlers ────────────────────────────────
  const [exportProgress, setExportProgress] = useState<{current: number; total: number} | null>(null);

  const handleExportAll = useCallback(async () => {
    setIsExporting(true);
    try { await exportCustomersExcel(customers); }
    catch { toast.error("Yuklab olishda xatolik"); }
    finally { setIsExporting(false); }
  }, [customers]);

  const handleExportDebtors = useCallback(async () => {
    setIsExporting(true);
    try { await exportDebtorsExcel(customers); }
    catch { toast.error("Yuklab olishda xatolik"); }
    finally { setIsExporting(false); }
  }, [customers]);

  // Barcha mijozlar savdolari — sana filteri bilan
  const handleExportAllSales = useCallback(async () => {
    if (!allSalesDateFrom && !allSalesDateTo) {
      toast.error("Iltimos, kamida bitta sanani tanlang");
      return;
    }
    setIsExporting(true);
    setExportProgress({ current: 0, total: customers.length });
    try {
      await exportAllCustomersSalesExcel(
        customers,
        allSalesDateFrom,
        allSalesDateTo,
        (current, total) => setExportProgress({ current, total }),
      );
      setShowAllSalesFilter(false);
      setAllSalesDateFrom('');
      setAllSalesDateTo('');
    } catch {
      toast.error("Yuklab olishda xatolik");
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [customers, allSalesDateFrom, allSalesDateTo]);

  if (selected) {
    return (
      <div className="space-y-4">
        <CustomerDetail customer={selected} onBack={() => setSelected(null)}
          onEdit={() => { setEditTarget(selected); setShowForm(true); }}
          onDelete={() => setDeleteTarget(selected)} />
        <Modal isOpen={showForm && !!editTarget} onClose={() => { setShowForm(false); setEditTarget(null); }} title="Mijozni tahrirlash" size="sm">
          {editTarget && (
            <CustomerFormModal customer={editTarget}
              onClose={() => {
                setShowForm(false); setEditTarget(null);
                qc.invalidateQueries({ queryKey: ["customers"] }).then(() => {
                  customersApi.getOne(selected.id).then(setSelected).catch(() => {});
                });
              }} />
          )}
        </Modal>
        <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="O'chirishni tasdiqlash" size="sm">
          <div className="space-y-4">
            <p className="text-gray-600 text-sm"><span className="font-semibold">{deleteTarget?.name}</span> mijozini o&apos;chirishni xohlaysizmi?</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Bekor</Button>
              <Button variant="danger" className="flex-1" isLoading={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>O&apos;chirish</Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OverdueDebtsBanner customers={customers} onSelect={c => setSelected(c)} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mijozlar</h1>
          <p className="text-gray-500 text-sm">{customers.length} ta mijoz · {debtorCount} ta qarzdor</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Qarzdorlar Excel */}
          {debtorCount > 0 && (
            <button onClick={handleExportDebtors} disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition-all">
              {isExporting ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download size={13} />}
              Qarzdorlar
            </button>
          )}
          {/* Barcha mijozlar savdolari sana bo'yicha */}
          <button
            onClick={() => setShowAllSalesFilter(v => !v)}
            disabled={isExporting}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              showAllSalesFilter
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-400'
            }`}
          >
            <Calendar size={13} />
            Savdolar (sana)
          </button>
          {/* Barcha mijozlar Excel */}
          <button onClick={handleExportAll} disabled={isExporting || customers.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition-all">
            {isExporting ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download size={13} />}
            Excel
          </button>
          <Button size="sm" leftIcon={<Plus size={15} />} onClick={() => { setEditTarget(null); setShowForm(true); }}>Yangi</Button>
        </div>
      </div>

      {/* ── Sana filter panel ── */}
      {showAllSalesFilter && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-indigo-800">
              Barcha mijozlar savdolari — sana bo'yicha yuklab olish
            </p>
            <button onClick={() => setShowAllSalesFilter(false)}
              className="text-indigo-400 hover:text-indigo-700 text-lg leading-none">×</button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Dan (boshlanish)</label>
              <input type="date" value={allSalesDateFrom}
                onChange={e => setAllSalesDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Gacha (tugash)</label>
              <input type="date" value={allSalesDateTo}
                onChange={e => setAllSalesDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white" />
            </div>
            <button
              onClick={handleExportAllSales}
              disabled={isExporting || (!allSalesDateFrom && !allSalesDateTo)}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all"
            >
              {isExporting
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Download size={15} />}
              Yuklab olish
            </button>
          </div>

          {/* Progress bar */}
          {exportProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-indigo-700 font-medium">
                <span>Yuklanmoqda...</span>
                <span>{exportProgress.current} / {exportProgress.total} ta mijoz</span>
              </div>
              <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((exportProgress.current / exportProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-xs text-indigo-600">
            Har bir mijozning savdo tarixi yuklab olinadi. Mijozlar soni ko'p bo'lsa bir oz vaqt ketishi mumkin.
          </p>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="flex items-center justify-center mb-1"><Users size={14} className="text-indigo-400" /></div>
          <p className="text-xs text-gray-400">Jami mijozlar</p>
          <p className="font-bold text-gray-900 text-lg">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="flex items-center justify-center mb-1"><AlertTriangle size={14} className="text-red-400" /></div>
          <p className="text-xs text-gray-400">Qarzdorlar</p>
          <p className="font-bold text-red-600 text-lg">{debtorCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <div className="flex items-center justify-center mb-1"><DollarSign size={14} className="text-red-400" /></div>
          <p className="text-xs text-gray-400">Jami qarz</p>
          <p className="font-bold text-red-600 text-sm">{fmt(totalDebt)}</p>
        </div>
      </div>

      {/* ── Qidiruv + Filter ── */}
      <div className="space-y-2">
        <Input placeholder="Ism yoki telefon bo'yicha qidirish..." icon={<Search size={16} />}
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1.5">
          {([{ k: "all", l: "Barchasi" }, { k: "debt", l: "Qarzdorlar" }, { k: "paid", l: "To'langan" }] as const).map(({ k, l }) => (
            <button key={k} onClick={() => setActiveFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeFilter === k ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ro'yxat ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <User size={40} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">Mijozlar topilmadi</p>
          <button onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">
            + Yangi mijoz qo&apos;shish
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredCustomers.map(c => {
            const debt = Number(c.totalDebt ?? 0);
            return (
              <div key={c.id} onClick={() => setSelected(c)}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3 cursor-pointer transition-all ${debt > 0 ? "bg-red-50/50 border-red-200 hover:border-red-300 hover:shadow-sm" : "bg-white border-gray-100 hover:border-indigo-300 hover:shadow-sm"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${debt > 0 ? "bg-red-100" : "bg-indigo-50"}`}>
                  <User size={18} className={debt > 0 ? "text-red-500" : "text-indigo-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{c.phone}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {debt > 0
                    ? <><p className="font-bold text-red-600 text-sm">{fmt(debt)}</p><p className="text-xs text-red-400">qarz</p></>
                    : <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">To&apos;langan</span>}
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ── */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditTarget(null); }}
        title={editTarget ? "Mijozni tahrirlash" : "Yangi mijoz"} size="sm">
        <CustomerFormModal customer={editTarget} onClose={() => { setShowForm(false); setEditTarget(null); }} />
      </Modal>
    </div>
  );
}