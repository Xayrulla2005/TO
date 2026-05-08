// ============================================================
// src/pages/statistics/StatisticsPage.tsx
// ============================================================
import { useState, useMemo, useCallback, memo } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "../shared/lib/axios";
import { formatCurrency, safeNumber } from "../shared/lib/utils";
import { StatisticsSummary, TimeRange } from "../shared/types/statistics";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  BarChart3, Percent, RotateCcw, Package, Tag,
  ArrowUp, ArrowDown, Minus, Download, RefreshCw, AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmt  = (v?: number | null) => "$" + formatCurrency(v ?? 0);
const fmtN = (v?: number | null) =>
  (v ?? 0).toLocaleString("uz-UZ", { maximumFractionDigits: 1 });

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return Math.round((part / total) * 100) + "%";
}

function marginColor(m: number): string {
  if (m >= 20) return "text-green-600";
  if (m >= 0)  return "text-amber-600";
  return "text-red-600";
}

function marginBg(m: number): string {
  if (m >= 20) return "bg-green-50 text-green-600";
  if (m >= 0)  return "bg-amber-50 text-amber-600";
  return "bg-red-50 text-red-500";
}

function getPerfDates(range: TimeRange): { perfStart: string; perfEnd: string } {
  const today    = new Date().toISOString().slice(0, 10);
  const perfEnd  = `${today}T23:59:59`;
  let   perfStart: string;

  if (range === "yearly") {
    perfStart = `${new Date().getFullYear()}-01-01T00:00:00`;
  } else if (range === "monthly") {
    perfStart = `${today.slice(0, 7)}-01T00:00:00`;
  } else if (range === "weekly") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    perfStart = d.toISOString();
  } else {
    perfStart = `${today}T00:00:00`;
  }
  return { perfStart, perfEnd };
}

// ─────────────────────────────────────────────────────────────
// BAR CHART
// ─────────────────────────────────────────────────────────────
const BarChart = memo(function BarChart({
  data,
  refunds,
  height = 180,
}: {
  data:     { label: string; value: number }[];
  refunds?: number[];
  height?:  number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (!data?.length) {
    return (
      <div
        className="flex items-center justify-center text-gray-300 text-sm"
        style={{ height }}
      >
        Ma&apos;lumot yo&apos;q
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const W = 600, H = height, pad = 28;
  const barW = Math.max(4, Math.floor((W - pad * 2) / data.length - 4));

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 24}`}
      className="w-full"
      style={{ height: height + 24 }}
      role="img"
      aria-label="Tushum dinamikasi grafigi"
    >
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="barGradHov" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6366f1" />
          <stop offset="100%" stopColor="#3730a3" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad}       y1={H - f * (H - pad)}
          x2={W - pad}   y2={H - f * (H - pad)}
          stroke="#f3f4f6" strokeWidth="1"
        />
      ))}

      {/* Y axis labels */}
      {[0.5, 1].map((f) => (
        <text
          key={f}
          x={pad - 4}
          y={H - f * (H - pad) + 4}
          textAnchor="end"
          fontSize="8"
          fill="#d1d5db"
        >
          {fmt(maxVal * f)}
        </text>
      ))}

      {data.map((d, i) => {
        const slotW = (W - pad * 2) / data.length;
        const x     = pad + i * slotW + (slotW - barW) / 2;
        const barH  = Math.max(2, (d.value / maxVal) * (H - pad));
        const y     = H - barH;
        const refH  = refunds?.[i]
          ? Math.max(2, (refunds[i] / maxVal) * (H - pad))
          : 0;
        const isHov = hovered === i;

        return (
          <g
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            role="button"
            tabIndex={0}
            aria-label={`${d.label}: ${fmt(d.value)}`}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={x} y={y} width={barW} height={barH} rx="3"
              fill={isHov ? "url(#barGradHov)" : "url(#barGrad)"}
              opacity={isHov ? 1 : 0.85}
            />
            {refH > 0 && (
              <rect
                x={x} y={H - refH} width={barW} height={refH} rx="2"
                fill="#ef4444" opacity="0.45"
              />
            )}
            {isHov && (
              <g>
                <rect
                  x={x - 22} y={y - 40}
                  width={barW + 44} height={refH > 0 ? 36 : 24}
                  rx="6" fill="#1f2937"
                />
                <text
                  x={x + barW / 2} y={y - 24}
                  textAnchor="middle" fontSize="10" fill="white" fontWeight="600"
                >
                  {fmt(d.value)}
                </text>
                {refH > 0 && (
                  <text
                    x={x + barW / 2} y={y - 10}
                    textAnchor="middle" fontSize="8" fill="#fca5a5"
                  >
                    -{fmt(refunds![i])}
                  </text>
                )}
              </g>
            )}
            <text
              x={x + barW / 2} y={H + 18}
              textAnchor="middle" fontSize="8" fill="#9ca3af"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────
// TREND BADGE
// ─────────────────────────────────────────────────────────────
const Trend = memo(function Trend({
  current,
  prev,
}: {
  current: number;
  prev?:   number;
}) {
  if (!prev || prev === 0) return null;
  const d   = ((current - prev) / Math.abs(prev)) * 100;
  const abs = Math.abs(d).toFixed(1);

  if (Math.abs(d) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
        <Minus size={10} /> 0%
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
        d > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
      }`}
      title={`O'tgan davrga nisbatan: ${d > 0 ? "+" : ""}${d.toFixed(1)}%`}
    >
      {d > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {abs}%
    </span>
  );
});

// ─────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────
const KpiCard = memo(function KpiCard({
  label, main, sub, icon: Icon, iconCls, trend,
}: {
  label:   string;
  main:    string;
  sub?:    string;
  icon:    React.ElementType;
  iconCls: string;
  trend?:  { current: number; prev?: number };
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconCls}`}>
          <Icon size={16} aria-hidden="true" />
        </div>
        {trend && <Trend current={trend.current} prev={trend.prev} />}
      </div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">{main}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// HORIZONTAL BAR
// ─────────────────────────────────────────────────────────────
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1" role="progressbar" aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-1.5 rounded-full transition-all duration-300"
        style={{ width: `${w}%`, background: color }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DONUT CHART
// ─────────────────────────────────────────────────────────────
const Donut = memo(function Donut({
  slices,
}: {
  slices: { label: string; value: number; color: string }[];
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);

  if (!total) {
    return (
      <div className="text-center text-gray-300 text-xs py-4">
        Ma&apos;lumot yo&apos;q
      </div>
    );
  }

  const r = 52, cx = 60, cy = 60, sw = 16;
  const circ = 2 * Math.PI * r;
  let cum = 0;

  return (
    <div className="flex items-center gap-4">
      <svg
        width={120}
        height={120}
        viewBox="0 0 120 120"
        className="flex-shrink-0"
        role="img"
        aria-label="Kategoriyalar bo'yicha taqsimot"
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={sw} />
        {slices.filter((s) => s.value > 0).map((s, i) => {
          const frac = s.value / total;
          const dash = frac * circ;
          const off  = circ - cum * circ;
          cum += frac;
          return (
            <circle
              key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={off}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            >
              <title>{s.label}: {pct(s.value, total)}</title>
            </circle>
          );
        })}
        <text x={cx} y={cy - 5}  textAnchor="middle" fontSize="8"  fill="#9ca3af">Jami</text>
        <text x={cx} y={cy + 9}  textAnchor="middle" fontSize="11" fontWeight="700" fill="#111827">
          {fmt(total)}
        </text>
      </svg>

      <div className="flex-1 space-y-2 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="text-xs text-gray-600 truncate flex-1">{s.label}</span>
            <span className="text-xs font-bold text-gray-700">{pct(s.value, total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} aria-hidden="true" />;
}

function PageSkeleton() {
  return (
    <div className="space-y-5 pb-8" aria-label="Yuklanmoqda..." aria-busy="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
        <AlertCircle size={24} className="text-red-500" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">Ma&apos;lumotlarni yuklashda xatolik</p>
        <p className="text-xs text-gray-400 mt-1">Internet aloqangizni tekshiring va qayta urining</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
      >
        <RefreshCw size={13} aria-hidden="true" />
        Qayta urinish
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const RANGE_LABELS: Record<TimeRange, string> = {
  daily: "Bugun", weekly: "Hafta", monthly: "Oy", yearly: "Yil",
};

const CAT_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
];

// ─────────────────────────────────────────────────────────────
// STATISTICS PAGE
// ─────────────────────────────────────────────────────────────
export function StatisticsPage() {
  const [range, setRange]           = useState<TimeRange>("monthly");
  const [isExporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const today       = new Date().toISOString().slice(0, 10);
  const { perfStart, perfEnd } = useMemo(() => getPerfDates(range), [range]);

  // ── Barcha querylar parallel ────────────────────────────
  const [curQuery, prevQuery, productsQuery, categoriesQuery, monthlyQuery] = useQueries({
    queries: [
      {
        queryKey: ["stats-summary", range],
        queryFn:  async (): Promise<StatisticsSummary> => {
          const { data } = await api.get("/statistics/summary", { params: { range } });
          return (data as any)?.data ?? data;
        },
        staleTime: 2 * 60_000,
        retry:     2,
      },
      {
        queryKey: ["stats-prev", range],
        queryFn:  async () => {
          const delta    = range === "daily" ? 1 : range === "weekly" ? 7 : range === "monthly" ? 30 : 365;
          const prevDate = new Date(Date.now() - delta * 86_400_000);
          const { data } = await api.get("/statistics", {
            params: { period: range, referenceDate: prevDate.toISOString() },
          });
          return (data as any)?.data ?? data;
        },
        staleTime: 5 * 60_000,
        retry:     1,
      },
      {
        queryKey: ["stats-products", range],
        queryFn:  async () => {
          const { data } = await api.get("/statistics/product-performance", {
            params: { startDate: perfStart, endDate: perfEnd, limit: 10 },
          });
          return (data as any)?.data ?? data;
        },
        staleTime: 2 * 60_000,
        retry:     2,
      },
      {
        queryKey: ["stats-categories", range],
        queryFn:  async () => {
          const { data } = await api.get("/statistics/category-performance", {
            params: { startDate: perfStart, endDate: perfEnd },
          });
          return (data as any)?.data ?? data;
        },
        staleTime: 2 * 60_000,
        retry:     2,
      },
      {
        queryKey: ["stats-monthly", currentYear],
        queryFn:  async () => {
          const { data } = await api.get("/statistics/monthly-breakdown", {
            params: { year: currentYear },
          });
          return (data as any)?.data ?? data;
        },
        staleTime: 10 * 60_000,
        retry:     2,
      },
    ],
  });

  const cur        = curQuery.data;
  const prev       = prevQuery.data;
  const products   = productsQuery.data;
  const categories = categoriesQuery.data;
  const monthly    = monthlyQuery.data;

  const isCurLoading = curQuery.isLoading;
  const isCurError   = curQuery.isError;
  const isFetching   = curQuery.isFetching;

  // ── Hisob-kitoblar ───────────────────────────────────────
  const revenue     = safeNumber(cur?.revenue);
  const realRevenue = safeNumber(cur?.realRevenue ?? cur?.revenue);
  const profit      = safeNumber((cur as any)?.realProfit ?? cur?.profit);
  const grossProfit = safeNumber((cur as any)?.grossProfit ?? cur?.profit);
  const orders      = safeNumber(cur?.ordersCount);
  const refunds     = safeNumber(cur?.totalRefunds);
  const refundCount = safeNumber(cur?.refundCount);
  const avgOrder    = safeNumber((cur as any)?.avgOrder ?? (orders > 0 ? revenue / orders : 0));
  const margin      = safeNumber(
    (cur as any)?.margin ??
    (realRevenue > 0 ? Math.round((profit / realRevenue) * 100) : 0),
  );

  const prevRevenue = safeNumber(prev?.totalRevenue);
  const prevProfit  = safeNumber(prev?.netProfit);
  const prevOrders  = safeNumber(prev?.totalSales);

  const chartData    = useMemo(
    () => (cur?.chartData || []) as { label: string; value: number }[],
    [cur],
  );
  const chartRefunds = useMemo(
    () => (cur?.chartData || []).map((d: any) => d.refunds || 0),
    [cur],
  );

  const maxProdRev = useMemo(
    () => Math.max(...(products || []).map((p: any) => safeNumber(p.totalRevenue)), 1),
    [products],
  );
  const maxCatRev = useMemo(
    () => Math.max(...(categories || []).map((c: any) => safeNumber(c.totalRevenue)), 1),
    [categories],
  );

  // ── Excel export ─────────────────────────────────────────
  const handleExportExcel = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { data } = await api.get("/statistics/export/excel", {
        params:       { type: range === "yearly" ? "yearly" : "monthly", year: currentYear },
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `statistika_${range}_${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Excel yuklab olishda xatolik. Qayta urinib ko'ring.");
    } finally {
      setExporting(false);
    }
  }, [range, currentYear, today]);

  // ── Loading & Error states ────────────────────────────────
  if (isCurLoading) return <PageSkeleton />;
  if (isCurError)   return <ErrorState onRetry={() => curQuery.refetch()} />;

  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-8">

      {/* ════════════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Savdo tahlili</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("uz-UZ", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Range tugmalari */}
          <div
            className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm gap-0.5"
            role="group"
            aria-label="Davr tanlash"
          >
            {(["daily", "weekly", "monthly", "yearly"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  range === r
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => curQuery.refetch()}
            disabled={isFetching}
            className="p-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50"
            aria-label="Ma'lumotlarni yangilash"
            title="Yangilash"
          >
            <RefreshCw
              size={14}
              className={`text-gray-500 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>

          {/* Excel export */}
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              aria-label="Excel formatda yuklab olish"
            >
              {isExporting ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              ) : (
                <Download size={13} aria-hidden="true" />
              )}
              Excel
            </button>
            {exportError && (
              <p className="text-xs text-red-500 text-right max-w-[180px]">{exportError}</p>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          KPI — ASOSIY 4 TA KO'RSATKICH
      ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Haqiqiy tushum"
          main={fmt(realRevenue)}
          sub={refunds > 0 ? `Qaytarishlar: -${fmt(refunds)}` : "Qaytarish yo'q"}
          icon={DollarSign}
          iconCls="bg-indigo-50 text-indigo-600"
          trend={{ current: realRevenue, prev: prevRevenue }}
        />
        <KpiCard
          label="Sof foyda"
          main={fmt(profit)}
          sub={`Margin: ${margin}%`}
          icon={profit >= 0 ? TrendingUp : TrendingDown}
          iconCls={profit >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}
          trend={{ current: profit, prev: prevProfit }}
        />
        <KpiCard
          label="Savdolar soni"
          main={`${fmtN(orders)} ta`}
          sub={`O'rtacha: ${fmt(avgOrder)}`}
          icon={ShoppingBag}
          iconCls="bg-blue-50 text-blue-600"
          trend={{ current: orders, prev: prevOrders }}
        />
        <KpiCard
          label="Qaytarishlar"
          main={`${fmtN(refundCount)} ta`}
          sub={refundCount > 0 ? `-${fmt(refunds)}` : "Hammasi yaxshi"}
          icon={RotateCcw}
          iconCls={refundCount > 0 ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-400"}
        />
      </div>

      {/* ════════════════════════════════════════════════════
          TO'LOV TAQSIMOTI
      ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Naqd pul",      value: cur?.paymentSplit?.cash, color: "#10b981", tc: "text-emerald-700" },
          { label: "Plastik karta", value: cur?.paymentSplit?.card, color: "#3b82f6", tc: "text-blue-700"    },
          { label: "Nasiya",        value: cur?.paymentSplit?.debt, color: "#ef4444", tc: "text-red-600"     },
        ].map(({ label, value, color, tc }) => {
          const v = safeNumber(value);
          return (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 font-medium">{label}</span>
                <span className="text-xs text-gray-300">{pct(v, revenue)}</span>
              </div>
              <p className={`text-base sm:text-lg font-bold ${tc}`}>{fmt(v)}</p>
              <div className="mt-2 bg-gray-100 rounded-full h-1.5" role="progressbar" aria-valuenow={Math.round((v / (revenue || 1)) * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: pct(v, revenue), background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════
          TUSHUM DINAMIKASI GRAFIK
      ════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Tushum dinamikasi</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {RANGE_LABELS[range]} · Ko&apos;k = tushum, Qizil = qaytarishlar
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" aria-hidden="true" />
              Tushum
            </span>
            {chartRefunds.some((v: number) => v > 0) && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-red-400 inline-block opacity-60" aria-hidden="true" />
                Qaytarishlar
              </span>
            )}
          </div>
        </div>
        <BarChart data={chartData} refunds={chartRefunds} height={200} />
      </div>

      {/* ════════════════════════════════════════════════════
          TOP MAHSULOTLAR + KATEGORIYALAR
      ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* TOP MAHSULOTLAR */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={15} className="text-indigo-500" aria-hidden="true" />
            <h2 className="font-bold text-gray-900 text-sm">Top mahsulotlar</h2>
            <span className="text-xs text-gray-300 ml-auto">{RANGE_LABELS[range]}</span>
          </div>

          {productsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : !products?.length ? (
            <div className="text-center text-gray-300 text-sm py-8">Ma&apos;lumot yo&apos;q</div>
          ) : (
            <div className="space-y-3">
              {(products as any[]).slice(0, 8).map((p, i) => {
                const m = safeNumber(
                  p.profitMargin ??
                  (p.totalRevenue > 0
                    ? Math.round((p.totalProfit / p.totalRevenue) * 100)
                    : 0),
                );
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                          i === 0 ? "bg-amber-100 text-amber-700"
                          : i === 1 ? "bg-gray-200 text-gray-600"
                          : i === 2 ? "bg-orange-100 text-orange-600"
                          : "bg-gray-50 text-gray-400"
                        }`}
                        aria-label={`${i + 1}-o'rin`}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-gray-800 flex-1 truncate">
                        {p.productName}
                      </span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${marginBg(m)}`}>
                        {m}%
                      </span>
                      <span className="text-xs font-bold text-indigo-600 w-16 text-right">
                        {fmt(p.totalRevenue)}
                      </span>
                    </div>
                    <div className="pl-7">
                      <HBar value={p.totalRevenue} max={maxProdRev} color={i < 3 ? "#6366f1" : "#c7d2fe"} />
                    </div>
                    <div className="pl-7 flex gap-3 text-xs text-gray-400 flex-wrap">
                      <span>{fmtN(p.totalQuantitySold)} ta sotildi</span>
                      <span aria-hidden="true">·</span>
                      <span>{p.salesCount} savdo</span>
                      <span aria-hidden="true">·</span>
                      <span>Foyda: {fmt(p.totalProfit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* KATEGORIYALAR */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={15} className="text-amber-500" aria-hidden="true" />
            <h2 className="font-bold text-gray-900 text-sm">Kategoriyalar</h2>
            <span className="text-xs text-gray-300 ml-auto">{RANGE_LABELS[range]}</span>
          </div>

          {categoriesQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : !categories?.length ? (
            <div className="text-center text-gray-300 text-sm py-8">Ma&apos;lumot yo&apos;q</div>
          ) : (
            <>
              <div className="mb-5">
                <Donut
                  slices={(categories as any[]).slice(0, 6).map((c, i) => ({
                    label: c.categoryName,
                    value: safeNumber(c.totalRevenue),
                    color: CAT_COLORS[i] ?? "#e5e7eb",
                  }))}
                />
              </div>
              <div className="space-y-2.5">
                {(categories as any[]).slice(0, 6).map((c, i) => {
                  const catMargin = safeNumber(
                    c.profitMargin ??
                    (c.totalRevenue > 0
                      ? Math.round((c.totalProfit / c.totalRevenue) * 100)
                      : 0),
                  );
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: CAT_COLORS[i] ?? "#e5e7eb" }}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                          {c.categoryName}
                        </span>
                        <span className={`text-xs font-semibold ${marginColor(catMargin)}`}>
                          {catMargin}%
                        </span>
                        <span className="text-xs font-bold text-gray-800 w-16 text-right">
                          {fmt(c.totalRevenue)}
                        </span>
                      </div>
                      <div className="pl-4">
                        <HBar
                          value={safeNumber(c.totalRevenue)}
                          max={maxCatRev}
                          color={CAT_COLORS[i] ?? "#e5e7eb"}
                        />
                      </div>
                      <div className="pl-4 flex gap-3 text-xs text-gray-400">
                        <span>{c.totalSales} savdo</span>
                        <span aria-hidden="true">·</span>
                        <span>Foyda: {fmt(c.totalProfit)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          YILLIK OYLIK PANORAMA
      ════════════════════════════════════════════════════ */}
      {(monthly as any[])?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={15} className="text-indigo-500" aria-hidden="true" />
            <h2 className="font-bold text-gray-900 text-sm">
              {currentYear} — oylik panorama
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">Har oy uchun tushum va qaytarishlar</p>

          <BarChart
            data={(monthly as any[]).map((m) => ({
              label: m.label,
              value: safeNumber(m.totalRevenue),
            }))}
            refunds={(monthly as any[]).map((m) => safeNumber(m.totalRefunds))}
            height={160}
          />

          {/* Oylik jadval */}
          <div className="mt-4 overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs min-w-[560px]" aria-label="Oylik statistika jadvali">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Oy", "Tushum", "Haqiqiy", "Foyda", "Savdo", "Qaytarish"].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`py-2 text-gray-400 font-medium ${i === 0 ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(monthly as any[]).map((m, i) => {
                  const isNow   = i === new Date().getMonth();
                  const mMargin = m.realRevenue > 0
                    ? Math.round((m.netProfit / m.realRevenue) * 100)
                    : 0;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-50 transition-colors ${
                        isNow ? "bg-indigo-50/60" : "hover:bg-gray-50/50"
                      }`}
                      aria-current={isNow ? "true" : undefined}
                    >
                      <td className={`py-2 font-medium ${isNow ? "text-indigo-700" : "text-gray-700"}`}>
                        {m.label}
                        {isNow && (
                          <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">
                            joriy
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 text-gray-700 font-semibold">
                        {fmt(m.totalRevenue)}
                      </td>
                      <td className="text-right py-2 text-gray-600">
                        {fmt(m.realRevenue)}
                      </td>
                      <td className={`text-right py-2 font-semibold ${mMargin >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {fmt(m.netProfit)}
                        <span className="text-gray-400 font-normal ml-1">({mMargin}%)</span>
                      </td>
                      <td className="text-right py-2 text-gray-600">{m.totalSales} ta</td>
                      <td className={`text-right py-2 ${m.totalRefunds > 0 ? "text-red-500 font-semibold" : "text-gray-300"}`}>
                        {m.totalRefunds > 0 ? `-${fmt(m.totalRefunds)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50/80">
                  <td className="py-2.5 font-bold text-gray-800">Jami</td>
                  <td className="text-right py-2.5 font-bold text-gray-900">
                    {fmt((monthly as any[]).reduce((s, m) => s + safeNumber(m.totalRevenue), 0))}
                  </td>
                  <td className="text-right py-2.5 font-bold text-gray-900">
                    {fmt((monthly as any[]).reduce((s, m) => s + safeNumber(m.realRevenue), 0))}
                  </td>
                  <td className="text-right py-2.5 font-bold text-green-700">
                    {fmt((monthly as any[]).reduce((s, m) => s + safeNumber(m.netProfit), 0))}
                  </td>
                  <td className="text-right py-2.5 font-bold text-gray-800">
                    {(monthly as any[]).reduce((s, m) => s + (m.totalSales || 0), 0)} ta
                  </td>
                  <td className="text-right py-2.5 font-bold text-red-500">
                    {(() => {
                      const t = (monthly as any[]).reduce(
                        (s, m) => s + safeNumber(m.totalRefunds), 0,
                      );
                      return t > 0 ? `-${fmt(t)}` : "—";
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MARGIN TAHLILI
      ════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-5">
          <Percent size={15} className="text-purple-500" aria-hidden="true" />
          <h2 className="font-bold text-gray-900 text-sm">Margin tahlili</h2>
          <span className="text-xs text-gray-300 ml-auto">{RANGE_LABELS[range]}</span>
        </div>

        {/* 3 asosiy ko'rsatkich */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Umumiy margin</p>
            <p className={`text-3xl font-black ${marginColor(margin)}`} aria-label={`Margin: ${margin} foiz`}>
              {margin}%
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {margin >= 20 ? "🟢 Yaxshi" : margin >= 10 ? "🟡 O'rtacha" : "🔴 Past"}
            </p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Yalpi foyda</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(grossProfit)}</p>
            <p className="text-xs text-gray-400 mt-1">qaytarishsiz</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Sof foyda</p>
            <p className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
              {fmt(profit)}
            </p>
            <p className="text-xs text-gray-400 mt-1">qaytarishlar ayirilgan</p>
          </div>
        </div>

        {/* Kategoriya margin bar chart */}
        {(categories as any[])?.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Kategoriya bo&apos;yicha margin
            </p>
            {(categories as any[]).slice(0, 7).map((c, i) => {
              const catM = safeNumber(
                c.profitMargin ??
                (c.totalRevenue > 0
                  ? Math.round((c.totalProfit / c.totalRevenue) * 100)
                  : 0),
              );
              const barW = Math.min(Math.abs(catM), 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: CAT_COLORS[i] ?? "#e5e7eb" }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-gray-600 w-24 truncate flex-shrink-0">
                    {c.categoryName}
                  </span>
                  <div
                    className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={catM}
                    aria-valuemin={-100}
                    aria-valuemax={100}
                    aria-label={`${c.categoryName}: ${catM}%`}
                  >
                    <div
                      className="h-4 rounded-full flex items-center justify-end pr-1.5 transition-all duration-500"
                      style={{
                        width:      `${barW}%`,
                        background: catM >= 20 ? "#10b981" : catM >= 0 ? "#f59e0b" : "#ef4444",
                        minWidth:   catM !== 0 ? "28px" : "0",
                      }}
                    >
                      <span className="text-white text-[10px] font-bold leading-none">
                        {catM}%
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-16 text-right flex-shrink-0">
                    {fmt(c.totalRevenue)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}