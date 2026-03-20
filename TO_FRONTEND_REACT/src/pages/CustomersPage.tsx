import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  customersApi,
  Customer,
  Sale,
  SaleReturn,
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
  Calendar, RotateCcw, Download, Share2, Printer,
} from "lucide-react";

const fmt = (v: number | string | null | undefined) => `$${formatCurrency(v)}`;

// ══════════════════════════════════════════════════════════════
// ── Universal PDF amallar (print / download / share) ──────────
// ══════════════════════════════════════════════════════════════

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function blobUrlToFile(blobUrl: string, filename: string): Promise<File> {
  return fetch(blobUrl)
    .then((r) => r.blob())
    .then((blob) => new File([blob], filename, { type: "application/pdf" }));
}


/** 3 ta tugma: Chop etish · PDF yuklash · Ulashish
 *  isPdfBlob=true  → asl PDF blob (backend dan kelgan)
 *  isPdfBlob=false → HTML blob (frontend da generatsiya qilingan)
 */
function PdfActionButtons({
  pdfUrl, filename, isPdfBlob = true,
}: {
  pdfUrl: string | null;
  filename: string;
  isPdfBlob?: boolean;
}) {
  const [sharing, setSharing] = useState(false);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!pdfUrl) return null;

  // ── Chop etish ──────────────────────────────────────────────
  const handlePrint = () => {
    const win = window.open(pdfUrl, "_blank");
    if (win) {
      win.addEventListener("load", () => { win.focus(); win.print(); });
    } else {
      toast.error("Popup bloklangan — brauzer sozlamalarini tekshiring");
    }
  };

  // ── Yuklash ─────────────────────────────────────────────────
  // PDF blob → to'g'ridan-to'g'ri .pdf fayl
  // HTML blob → chop etish oynasi + "Save as PDF" yo'riqnomasi
  const handleDownload = () => {
    if (isPdfBlob) {
      triggerDownload(pdfUrl, filename);
    } else {
      // HTML ni yangi oynada ochamiz, foydalanuvchi Ctrl+P → Save as PDF qiladi
      const win = window.open(pdfUrl, "_blank");
      if (win) {
        win.addEventListener("load", () => {
          win.focus();
          // Avtomatik print dialog (brauzer bloklamasa)
          setTimeout(() => win.print(), 400);
        });
      } else {
        // Popup bloklangan → HTML faylni yuklaymiz
        triggerDownload(pdfUrl, filename.replace(".pdf", ".html"));
        toast.success("HTML fayl yuklandi — brauzerda ochib Ctrl+P → Save as PDF");
      }
    }
  };

  // ── Ulashish ────────────────────────────────────────────────
  const handleShare = async () => {
    setSharing(true);
    try {
      if (isPdfBlob) {
        // PDF faylni to'g'ridan-to'g'ri ulashish
        const canShareFile =
          typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [new File([], "t.pdf", { type: "application/pdf" })] });

        if (canShareFile) {
          const file = await blobUrlToFile(pdfUrl, filename);
          await navigator.share({ title: filename.replace(".pdf", ""), files: [file] });
        } else if (typeof navigator.share === "function") {
          await navigator.share({ title: filename.replace(".pdf", ""), url: window.location.href });
        } else {
          triggerDownload(pdfUrl, filename);
          toast.success("PDF yuklandi — Telegram/WhatsApp orqali yuboring");
        }
      } else {
        // HTML blob → chop etish oynasida PDF saqlab, keyin ulashish
        // Yoki HTML faylni yuklab Telegram ga biriktirish
        triggerDownload(pdfUrl, filename.replace(".pdf", ".html"));
        toast.success("Fayl yuklandi — uni Telegram/WhatsApp ga yuboring");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        triggerDownload(pdfUrl, isPdfBlob ? filename : filename.replace(".pdf", ".html"));
        toast.success("Fayl yuklandi");
      }
    } finally {
      setSharing(false);
    }
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
        <Download size={15} /> {isPdfBlob ? "PDF yuklash" : "PDF yuklash"}
      </button>
      <button onClick={handleShare} disabled={sharing}
        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60">
        {sharing
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <Share2 size={15} />}
        Ulashish
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════

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
    PENDING:        { cls: "bg-red-100 text-red-700",          label: "To'lanmagan" },
    PARTIALLY_PAID: { cls: "bg-amber-100 text-amber-700",      label: "Qisman" },
    PAID:           { cls: "bg-emerald-100 text-emerald-700",  label: "To'langan" },
    CANCELLED:      { cls: "bg-gray-100 text-gray-500",        label: "Bekor" },
  };
  const c = cfg[status] ?? { cls: "bg-gray-100 text-gray-500", label: status };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.cls}`}>{c.label}</span>;
}

// ── Debt List Modal ───────────────────────────────────────────
function DebtListModal({ customerId, customerName, customerPhone, onClose, onPayDebt }: {
  customerId: string;
  customerName: string;
  customerPhone: string;
  onClose: () => void;
  onPayDebt: (debtId: string, remaining: number) => void;
}) {
  const { data: salesData, isLoading } = useQuery({
    queryKey: ["customer-sales-debts", customerId],
    queryFn: () => customersApi.getSales(customerId, 1, 100),
  });

  const activeDebts = useMemo(() => {
    const sales = (salesData?.data ?? []) as Sale[];
    return sales
      .filter(s => s.debt && (s.debt.status === "PENDING" || s.debt.status === "PARTIALLY_PAID"))
      .map(s => ({ sale: s, debt: s.debt! }))
      .sort((a, b) =>
        new Date(a.sale.completedAt || a.sale.createdAt).getTime() -
        new Date(b.sale.completedAt || b.sale.createdAt).getTime()
      );
  }, [salesData]);

  const totalRemaining  = Math.round(activeDebts.reduce((s, { debt }) => s + Number(debt.remainingAmount),  0) * 100) / 100;
  const totalDebtTaken  = Math.round(activeDebts.reduce((s, { debt }) => s + Number(debt.originalAmount),   0) * 100) / 100;
  const totalPaid       = Math.round((totalDebtTaken - totalRemaining) * 100) / 100;

  const [pdfUrl, setPdfUrl]         = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Jadval HTML ni PDF blob ga aylantiradi (backend ga murojaat qilmaydi)

  const tableRef = useRef<HTMLDivElement>(null);

  const handleShowPdf = async () => {
    if (activeDebts.length === 0) return;
    if (pdfUrl) return;
    setPdfLoading(true);
    try {
      // jsPDF + html2canvas bilan jadval elementini PDF ga aylantirish
      const element = tableRef.current;
      if (!element) { toast.error("Jadval topilmadi"); return; }

      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF }                = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW   = pdf.internal.pageSize.getWidth();
      const pageH   = pdf.internal.pageSize.getHeight();
      const margin  = 10;
      const imgW    = pageW - margin * 2;
      const imgH    = (canvas.height * imgW) / canvas.width;

      let y = margin;
      if (imgH <= pageH - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, y, imgW, imgH);
      } else {
        // Ko'p sahifa
        let remainH = imgH;
        let srcY    = 0;
        while (remainH > 0) {
          const sliceH = Math.min(pageH - margin * 2, remainH);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width  = canvas.width;
          sliceCanvas.height = (sliceH / imgH) * canvas.height;
          const ctx = sliceCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, srcY * (canvas.height / imgH), canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
          if (srcY > 0) pdf.addPage();
          pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", margin, margin, imgW, sliceH);
          srcY    += sliceH;
          remainH -= sliceH;
        }
      }

      const pdfBlob = pdf.output("blob");
      const url     = window.URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
    } catch (e) {
      console.error(e);
      toast.error("PDF yaratilmadi — npm install jspdf html2canvas");
    } finally {
      setPdfLoading(false);
    }
  };

  let rowNum = 0;

  if (isLoading) return (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
    </div>
  );

  if (activeDebts.length === 0) return (
    <div className="text-center py-8 text-gray-400">
      <AlertTriangle size={32} className="mx-auto mb-2 opacity-20" />
      <p className="text-sm">Faol qarzlar yo'q</p>
    </div>
  );

  return (
    <div className="space-y-3">

      {/* ── Har doim jadval ko'rinishi ── */}
      <div ref={tableRef} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Sarlavha */}
        <div className="bg-gray-800 px-4 py-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-bold text-sm">QARZDORLIK FAKTURASI</p>
              <p className="text-gray-300 text-xs mt-0.5">
                {new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-sm">{customerName}</p>
              <p className="text-gray-300 text-xs mt-0.5">{customerPhone}</p>
            </div>
          </div>
        </div>

        {/* Jadval */}
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="text-center px-2 py-2 font-semibold text-gray-500 w-8">№</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-500">Mahsulot nomi</th>
              <th className="text-center px-2 py-2 font-semibold text-gray-500 w-14">Miqdor</th>
              <th className="text-center px-2 py-2 font-semibold text-gray-500 w-16">Narxi</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-500 w-16">Summa</th>
            </tr>
          </thead>
          <tbody>
            {activeDebts.map(({ sale, debt }, sIdx) => {
              const saleDate      = sale.completedAt || sale.createdAt;
              const paidAmount    = Math.round((Number(debt.originalAmount) - Number(debt.remainingAmount)) * 100) / 100;
              const debtRemaining = Math.round(Number(debt.remainingAmount) * 100) / 100;
              const isPartial     = debt.status === "PARTIALLY_PAID";
              const bgAlt         = sIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";

              return (
                <>
                  <tr key={`h-${debt.id}`} className="bg-slate-700">
                    <td colSpan={5} className="px-3 py-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold">#{sale.saleNumber}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            isPartial ? "bg-amber-400 text-amber-900" : "bg-red-400 text-white"
                          }`}>
                            {isPartial ? "Qisman" : "To'lanmagan"}
                          </span>
                        </div>
                        <span className="text-gray-300 text-xs">
                          {format(parseISO(saleDate), "dd.MM.yyyy  HH:mm")}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {sale.items.map((item: any) => {
                    rowNum++;
                    return (
                      <tr key={item.id} className={`border-b border-gray-100 ${bgAlt}`}>
                        <td className="text-center px-2 py-1.5 text-gray-400">{rowNum}</td>
                        <td className="px-3 py-1.5 text-gray-700">{item.productNameSnapshot}</td>
                        <td className="text-center px-2 py-1.5 text-gray-500">{item.quantity}</td>
                        <td className="text-center px-2 py-1.5 text-gray-500">{fmt(item.customUnitPrice)}</td>
                        <td className="text-right px-3 py-1.5 font-medium text-gray-800">{fmt(item.customTotal)}</td>
                      </tr>
                    );
                  })}

                  <tr key={`total-${debt.id}`} className={`border-b border-gray-200 ${bgAlt}`}>
                    <td colSpan={4} className="px-3 py-1.5 text-gray-400 text-right text-xs border-t border-dashed border-gray-200">Savdo jami</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gray-700 border-t border-dashed border-gray-200">{fmt(sale.grandTotal)}</td>
                  </tr>
                  <tr key={`debt-${debt.id}`} className="bg-red-50">
                    <td colSpan={4} className="px-3 py-1.5 text-red-600 text-right text-xs font-medium">Qarzga olingan</td>
                    <td className="px-3 py-1.5 text-right font-bold text-red-600">{fmt(Number(debt.originalAmount))}</td>
                  </tr>
                  {isPartial && (
                    <>
                      <tr key={`paid-${debt.id}`} className="bg-emerald-50">
                        <td colSpan={4} className="px-3 py-1.5 text-emerald-600 text-right text-xs font-medium">To'langan qismi</td>
                        <td className="px-3 py-1.5 text-right font-bold text-emerald-600">{fmt(paidAmount)}</td>
                      </tr>
                      <tr key={`rem-${debt.id}`} className="bg-amber-50 border-b-2 border-amber-200">
                        <td colSpan={4} className="px-3 py-2 text-amber-700 text-right text-xs font-bold">Qoldiq qarz</td>
                        <td className="px-3 py-2 text-right font-black text-amber-700">{fmt(debtRemaining)}</td>
                      </tr>
                    </>
                  )}
                  {!isPartial && (
                    <tr key={`undirm-${debt.id}`} className="bg-red-100 border-b-2 border-red-200">
                      <td colSpan={4} className="px-3 py-2 text-red-700 text-right text-xs font-bold">Undirilmagan qarz</td>
                      <td className="px-3 py-2 text-right font-black text-red-700">{fmt(debtRemaining)}</td>
                    </tr>
                  )}
                </>
              );
            })}

            <tr className="bg-gray-800">
              <td colSpan={2} className="px-3 py-3 text-white font-bold text-sm">
                Jami: {activeDebts.length} ta savdo
              </td>
              <td colSpan={2} className="px-3 py-3 text-gray-300 text-right text-xs">
                Jami olingan qarz: {fmt(totalDebtTaken)}
                {totalPaid > 0 && <span className="ml-3 text-emerald-400">To'langan: {fmt(totalPaid)}</span>}
              </td>
              <td className="px-3 py-3 text-right">
                <p className="text-yellow-400 font-black text-base">{fmt(totalRemaining)}</p>
                <p className="text-gray-400 text-xs">umumiy qarz</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── PDF tayyor bo'lsa — 3 ta tugma, yo'q bo'lsa "PDF ko'rish" ── */}
      {pdfUrl ? (
        <PdfActionButtons pdfUrl={pdfUrl} filename={`qarz-${customerName}.pdf`} isPdfBlob={true} />
      ) : (
        <button
          onClick={handleShowPdf}
          disabled={pdfLoading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm py-3 rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
        >
          {pdfLoading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> PDF yuklanmoqda...</>
          ) : (
            <><FileText size={16} /> PDF ko'rish</>
          )}
        </button>
      )}

      {/* To'lash tugmasi — har doim ko'rinadi */}
      {activeDebts.length > 0 && (
        <button
          onClick={() => { const first = activeDebts[0]; onPayDebt(first.debt.id, first.debt.remainingAmount); onClose(); }}
          className="w-full bg-emerald-600 text-white text-sm py-3 rounded-xl font-bold hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <DollarSign size={15} />
          To'lash — {fmt(activeDebts[0].debt.remainingAmount)}
          {activeDebts.length > 1 && (
            <span className="text-xs opacity-75">(#{activeDebts[0].sale.saleNumber})</span>
          )}
        </button>
      )}
    </div>
  );
}

// ── Return Modal ──────────────────────────────────────────────
function ReturnModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const qc = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(sale.items.map((i) => [i.id, "0"]))
  );
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [returnResult, setReturnResult] = useState<SaleReturn | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const selectedItems = sale.items
    .map((item) => ({ item, qty: parseFloat(quantities[item.id] || "0") }))
    .filter(({ qty }) => qty > 0);

  const totalRefund = selectedItems.reduce(
    (s, { item, qty }) => s + qty * item.customUnitPrice, 0
  );

  const downloadReceipt = async (returnId: string) => {
    setLoadingReceipt(true);
    try {
      const blob = await customersApi.getReturnReceipt(returnId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      setReceiptUrl(url);
    } catch { toast.error("Chek yuklanmadi"); }
    finally { setLoadingReceipt(false); }
  };

  const mutation = useMutation({
    mutationFn: () =>
      customersApi.createReturn({
        originalSaleId: sale.id,
        reason: reason || undefined,
        items: selectedItems.map(({ item, qty }) => ({
          saleItemId: item.id,
          quantity: qty,
          reason: reason || undefined,
        })),
      }),
    onSuccess: async (result) => {
      toast.success("Qaytarish so'rovi yaratildi");
      qc.invalidateQueries({ queryKey: ["customer-sales"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setReturnResult(result);
      setDone(true);
      await downloadReceipt(result.id);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Xatolik yuz berdi"),
  });

  if (done) {
    return (
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
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
          <span className="font-semibold">Eslatma:</span> Qaytarish Admin tomonidan tasdiqlanganidan keyin stok tiklanadi.
        </div>
        {loadingReceipt ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : receiptUrl ? (
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
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 flex items-center justify-between">
        <span>Savdo: <span className="font-semibold">#{sale.saleNumber}</span></span>
        <span>Jami: <span className="font-semibold text-indigo-700">{fmt(sale.grandTotal)}</span></span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sale.items.map((item) => {
          const qty = parseFloat(quantities[item.id] || "0");
          const max = item.quantity;
          const isSelected = qty > 0;
          return (
            <div key={item.id} className={`rounded-xl border p-3 transition-all ${
              isSelected ? "border-purple-300 bg-purple-50/40" : "border-gray-100 bg-white"
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">
                    {item.productNameSnapshot}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmt(item.customUnitPrice)} · Jami: {item.quantity} {item.unitSnapshot}
                  </p>
                </div>
                {isSelected && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                    -{fmt(qty * item.customUnitPrice)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 flex-shrink-0">Qaytarish:</span>
                <button
                  onClick={() => { const cur = parseFloat(quantities[item.id] || "0"); if (cur > 0) setQuantities(p => ({ ...p, [item.id]: String(cur - 1) })); }}
                  className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors">−</button>
                <input
                  type="number" min={0} max={max} step="any" value={quantities[item.id]}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = parseFloat(val);
                    if (val === "" || val === "0") { setQuantities(p => ({ ...p, [item.id]: val })); return; }
                    if (!isNaN(num) && num >= 0 && num <= max) setQuantities(p => ({ ...p, [item.id]: val }));
                  }}
                  className="w-14 text-center text-xs border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-purple-400 font-bold"
                />
                <button
                  onClick={() => { const cur = parseFloat(quantities[item.id] || "0"); if (cur < max) setQuantities(p => ({ ...p, [item.id]: String(cur + 1) })); }}
                  className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors">+</button>
                <span className="text-xs text-gray-400">/ {max}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Qaytarish sababi</label>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Masalan: mahsulot nuqsonli..." rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
        />
      </div>

      {totalRefund > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex justify-between items-center">
          <span className="text-sm text-purple-700 font-medium">Qaytariladigan summa:</span>
          <span className="text-lg font-bold text-purple-700">{fmt(totalRefund)}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Bekor</Button>
        <Button
          className="flex-1 !bg-purple-600 hover:!bg-purple-700"
          isLoading={mutation.isPending}
          disabled={selectedItems.length === 0}
          onClick={() => { if (selectedItems.length === 0) { toast.error("Kamida 1 ta mahsulot tanlang"); return; } mutation.mutate(); }}
        >
          Qaytarishni yuborish
        </Button>
      </div>
    </div>
  );
}

// ── Customer Form Modal ───────────────────────────────────────
function CustomerFormModal({ customer, onClose }: { customer?: Customer | null; onClose: () => void }) {
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
        label="To'liq ism *" value={name}
        onChange={(e) => setName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
        placeholder="Mijoz ismi"
      />
      <Input
        label="Telefon raqami *" value={phone} type="tel"
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
      />
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Izoh</label>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Qo'shimcha ma'lumot..." rows={3}
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

// ── Pay Debt Modal ────────────────────────────────────────────
function PayDebtModal({ debtId, remaining, onClose }: { debtId: string; remaining: number; onClose: () => void }) {
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
    } catch { toast.error("Chek yuklanmadi"); }
    finally { setLoadingReceipt(false); }
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/debts/${debtId}/payment`, { amount: Number(amount), paymentMethod: method, notes: note || undefined }),
    onSuccess: () => {
      toast.success("To'lov amalga oshirildi!");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-sales"] });
      qc.invalidateQueries({ queryKey: ["customer-sales-debts"] });
      qc.invalidateQueries({ queryKey: ["customer-stats"] });
      setPaidAmount(Number(amount));
      setPaid(true);
      downloadReceipt(debtId);
    },
    onError: () => toast.error("Xatolik yuz berdi"),
  });

  if (paid) {
    return (
      <div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Banknote size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-emerald-800 text-sm">To'lov muvaffaqiyatli!</p>
            <p className="text-xs text-emerald-600">${paidAmount.toLocaleString("uz-UZ")} to'landi</p>
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
            <PdfActionButtons pdfUrl={receiptUrl} filename={`qarz-chek-${debtId.slice(0, 8)}.pdf`} />
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
      <div className="bg-red-50 border border-red-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={16} className="text-red-500" />
          <p className="text-sm font-semibold text-red-700">Qarz summasi</p>
        </div>
        <p className="text-2xl font-bold text-red-600">{fmt(remaining)}</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To'lov summasi</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={remaining} min={1}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 font-semibold text-lg" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">To'lov usuli</label>
        <div className="flex gap-2">
          {(["CASH", "CARD"] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                method === m ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {m === "CASH" ? <><Banknote size={15} />Naqd</> : <><CreditCard size={15} />Karta</>}
            </button>
          ))}
        </div>
      </div>
      <Input label="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Izoh..." />
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Bekor</Button>
        <Button className="flex-1" isLoading={mutation.isPending} onClick={() => {
          if (!amount || Number(amount) <= 0) { toast.error("Summa kiriting"); return; }
          if (Number(amount) > remaining) { toast.error("Summa qarzdan oshib ketdi"); return; }
          mutation.mutate();
        }}>To'lash</Button>
      </div>
    </div>
  );
}

// ── Sale Receipt Modal ────────────────────────────────────────
function SaleReceiptModal({ saleId, saleNumber }: { saleId: string; saleNumber: string; onClose: () => void }) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    api.get(`/sales/${saleId}/receipt`, { responseType: "blob" })
      .then((res) => {
        objectUrl = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        setReceiptUrl(objectUrl);
      })
      .catch(() => toast.error("Chek yuklanmadi"))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) window.URL.revokeObjectURL(objectUrl); };
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
          <PdfActionButtons pdfUrl={receiptUrl} filename={`chek-${saleNumber}.pdf`} />
        </>
      ) : (
        <p className="text-center text-gray-400 py-8">Chek topilmadi</p>
      )}
    </div>
  );
}

// ── Sale Card ─────────────────────────────────────────────────
function SaleCard({ sale, onPayDebt, onViewReceipt, onReturn }: {
  sale: Sale;
  onPayDebt: (debtId: string, remaining: number) => void;
  onViewReceipt: (saleId: string, saleNumber: string) => void;
  onReturn: (sale: Sale) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDebt    = sale.debt && sale.debt.remainingAmount > 0;
  const isDebtSale = sale.payments?.some(p => p.method === "DEBT");
  const hasReturns = sale.returns && sale.returns.length > 0;
  const isReturned = sale.status === "RETURNED";

  return (
    <div className={`rounded-xl overflow-hidden border-2 transition-all ${
      hasDebt ? "border-red-200 bg-red-50/30"
      : isDebtSale && sale.debt?.status === "PAID" ? "border-emerald-200 bg-emerald-50/20"
      : isReturned ? "border-purple-200 bg-purple-50/20"
      : "border-gray-100 bg-white"
    }`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          hasDebt ? "bg-red-100" : isReturned ? "bg-purple-100" : "bg-indigo-50"
        }`}>
          {isReturned
            ? <RotateCcw size={16} className="text-purple-500" />
            : <ShoppingBag size={16} className={hasDebt ? "text-red-500" : "text-indigo-500"} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">#{sale.saleNumber}</p>
            {hasDebt && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-semibold">Nasiya</span>}
            {isDebtSale && sale.debt?.status === "PAID" && <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-md font-semibold">To'landi</span>}
            {isReturned && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md font-semibold">Qaytarildi</span>}
            {hasReturns && !isReturned && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md font-semibold">Qisman qaytarildi</span>}
          </div>
          <p className="text-xs text-gray-400">{sale.completedAt ? format(parseISO(sale.completedAt), "HH:mm") : "—"}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-sm text-gray-900">{fmt(sale.grandTotal)}</p>
          {hasDebt && <p className="text-xs text-red-500 font-semibold">{fmt(sale.debt!.remainingAmount)} qarz</p>}
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
              <button onClick={() => onPayDebt(sale.debt!.id, sale.debt!.remainingAmount)}
                className="bg-emerald-600 text-white text-xs px-3 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors">
                To'lash
              </button>
            </div>
          )}

          {hasReturns && (
            <div className="space-y-1.5">
              {sale.returns!.map((ret) => (
                <div key={ret.id} className={`rounded-lg px-3 py-2 flex items-center justify-between text-xs ${
                  ret.status === "APPROVED" ? "bg-purple-50 border border-purple-100"
                  : ret.status === "PENDING" ? "bg-amber-50 border border-amber-100"
                  : "bg-gray-50 border border-gray-100"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <RotateCcw size={11} className={
                      ret.status === "APPROVED" ? "text-purple-500"
                      : ret.status === "PENDING" ? "text-amber-500" : "text-gray-400"
                    } />
                    <span className="font-semibold text-gray-700">#{ret.returnNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                      ret.status === "APPROVED" ? "bg-purple-100 text-purple-700"
                      : ret.status === "PENDING" ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                    }`}>
                      {ret.status === "APPROVED" ? "Tasdiqlandi" : ret.status === "PENDING" ? "Kutilmoqda" : "Rad etildi"}
                    </span>
                  </div>
                  <span className={`font-bold ${ret.status === "APPROVED" ? "text-purple-700" : "text-gray-500"}`}>
                    -{fmt(ret.refundAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {sale.status === "COMPLETED" && (
            <button onClick={() => onReturn(sale)}
              className="w-full flex items-center justify-center gap-2 text-xs text-purple-600 font-semibold py-2 rounded-lg hover:bg-purple-50 transition-colors border border-purple-100">
              <RotateCcw size={13} /> Qaytarish
            </button>
          )}

          <button onClick={() => onViewReceipt(sale.id, sale.saleNumber)}
            className="w-full flex items-center justify-center gap-2 text-xs text-indigo-600 font-semibold py-2 rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-100">
            <FileText size={13} /> Chekni ko'rish
          </button>
        </div>
      )}
    </div>
  );
}

// ── Customer Detail ───────────────────────────────────────────
function CustomerDetail({ customer, onBack, onEdit, onDelete }: {
  customer: Customer; onBack: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [tab, setTab] = useState<"sales" | "stats">("sales");
  const [payingDebt, setPayingDebt]         = useState<{ id: string; remaining: number } | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<{ id: string; number: string } | null>(null);
  const [returningItem, setReturningItem]   = useState<Sale | null>(null);
  const [showDebtList, setShowDebtList]     = useState(false);
  const [salesPage, setSalesPage]           = useState(1);

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
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-lg truncate">{customer.name}</h2>
          <p className="text-sm text-gray-500 flex items-center gap-1"><Phone size={12} />{customer.phone}</p>
        </div>
        <button onClick={onEdit} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <Edit2 size={18} className="text-gray-500" />
        </button>
        <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-xl transition-colors">
          <Trash2 size={18} className="text-red-400" />
        </button>
      </div>

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
            className={`rounded-xl p-3 text-center transition-all ${
              stats.totalDebt > 0
                ? "bg-red-50 hover:bg-red-100 hover:shadow-sm cursor-pointer active:scale-95"
                : "bg-gray-50 cursor-default"
            }`}>
            <p className={`text-xs font-medium ${stats.totalDebt > 0 ? "text-red-400" : "text-gray-400"}`}>Qarz</p>
            <p className={`font-bold text-sm ${stats.totalDebt > 0 ? "text-red-700" : "text-gray-500"}`}>{fmt(stats.totalDebt)}</p>
            {stats.totalDebt > 0 && <p className="text-xs text-red-400 mt-0.5">ko'rish →</p>}
          </button>
        </div>
      )}

      {customer.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
          <span className="font-semibold">Izoh: </span>{customer.notes}
        </div>
      )}

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {[
          { k: "sales", label: "Savdolar", icon: ShoppingBag },
          { k: "stats", label: "Statistika", icon: BarChart2 },
        ].map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === k ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

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
                        key={sale.id} sale={sale}
                        onPayDebt={(id, remaining) => setPayingDebt({ id, remaining })}
                        onViewReceipt={(id, number) => setViewingReceipt({ id, number })}
                        onReturn={(s) => setReturningItem(s)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {(salesData?.total ?? 0) > 20 && (
                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={() => setSalesPage(p => Math.max(1, p - 1))} disabled={salesPage === 1}>Oldingi</Button>
                  <span className="text-sm text-gray-500">{salesPage} / {Math.ceil((salesData?.total ?? 0) / 20)}</span>
                  <Button variant="outline" size="sm" onClick={() => setSalesPage(p => p + 1)} disabled={salesPage >= Math.ceil((salesData?.total ?? 0) / 20)}>Keyingi</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

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
                              <div className="bg-indigo-500 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, (val.amount / (stats.totalAmount || 1)) * 100 * 3)}%` }} />
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

      <Modal isOpen={showDebtList} onClose={() => setShowDebtList(false)} title="Faol qarzlar" size="sm">
        <DebtListModal
          customerId={customer.id} customerName={customer.name} customerPhone={customer.phone}
          onClose={() => setShowDebtList(false)}
          onPayDebt={(id, remaining) => { setShowDebtList(false); setPayingDebt({ id, remaining }); }}
        />
      </Modal>

      <Modal isOpen={!!payingDebt} onClose={() => setPayingDebt(null)} title="Qarz to'lovi" size="sm">
        {payingDebt && <PayDebtModal debtId={payingDebt.id} remaining={payingDebt.remaining} onClose={() => setPayingDebt(null)} />}
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

// ── Main Page ─────────────────────────────────────────────────
export function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch]             = useState("");
  const [filter, setFilter]             = useState<"all" | "debt" | "paid">("all");
  const [selected, setSelected]         = useState<Customer | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [editTarget, setEditTarget]     = useState<Customer | null>(null);
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

  const totalDebt   = useMemo(() => customers.reduce((s: number, c: any) => s + (c.totalDebt ?? 0), 0), [customers]);
  const debtorCount = useMemo(() => customers.filter((c: any) => (c.totalDebt ?? 0) > 0).length, [customers]);

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
          customer={selected} onBack={() => setSelected(null)}
          onEdit={() => { setEditTarget(selected); setShowForm(true); }}
          onDelete={() => setDeleteTarget(selected)}
        />
        <Modal isOpen={showForm && !!editTarget} onClose={() => { setShowForm(false); setEditTarget(null); }} title="Mijozni tahrirlash" size="sm">
          {editTarget && (
            <CustomerFormModal customer={editTarget} onClose={() => {
              setShowForm(false); setEditTarget(null);
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
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>O'chirish</Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mijozlar</h1>
          <p className="text-gray-500 text-sm">{customers.length} ta mijoz · {debtorCount} ta qarzdor</p>
        </div>
        <Button size="sm" leftIcon={<Plus size={15} />} onClick={() => { setEditTarget(null); setShowForm(true); }}>Yangi</Button>
      </div>

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

      <div className="space-y-2">
        <Input placeholder="Ism yoki telefon bo'yicha qidirish..." icon={<Search size={16} />}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-1.5">
          {[{ k: "all", l: "Barchasi" }, { k: "debt", l: "Qarzdorlar" }, { k: "paid", l: "To'langan" }].map(({ k, l }) => (
            <button key={k} onClick={() => setFilter(k as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === k ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"
              }`}>{l}</button>
          ))}
        </div>
      </div>

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
              <div key={c.id} onClick={() => setSelected(c)}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3 cursor-pointer transition-all ${
                  debt > 0
                    ? "bg-red-50/50 border-red-200 hover:border-red-300 hover:shadow-sm"
                    : "bg-white border-gray-100 hover:border-indigo-300 hover:shadow-sm"
                }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${debt > 0 ? "bg-red-100" : "bg-indigo-50"}`}>
                  <User size={18} className={debt > 0 ? "text-red-500" : "text-indigo-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{c.phone}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {debt > 0 ? (
                    <><p className="font-bold text-red-600 text-sm">{fmt(debt)}</p><p className="text-xs text-red-400">qarz</p></>
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

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditTarget(null); }}
        title={editTarget ? "Mijozni tahrirlash" : "Yangi mijoz"} size="sm">
        <CustomerFormModal customer={editTarget} onClose={() => { setShowForm(false); setEditTarget(null); }} />
      </Modal>
    </div>
  );
}