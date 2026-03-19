import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { statisticsApi } from '../features/statistics/api/statistics.api';
import { api } from "../shared/lib/axios";
import { formatCurrency, safeNumber } from "../shared/lib/utils";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag,
  BarChart3, Percent, RotateCcw, Package, Tag,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";

type TimeRange = "daily" | "weekly" | "monthly" | "yearly";

const fmt  = (v?: number | null) => "$" + formatCurrency(v ?? 0);
const fmtN = (v?: number | null) => (v ?? 0).toLocaleString("uz-UZ", { maximumFractionDigits: 1 });

function pct(part: number, total: number) {
  if (!total) return "0%";
  return Math.round((part / total) * 100) + "%";
}

function marginColor(m: number) {
  if (m >= 20) return "text-green-600";
  if (m >= 0)  return "text-amber-600";
  return "text-red-600";
}

// ── Inline SVG Bar Chart ───────────────────────────────────────
function BarChart({
  data, refunds, height = 180,
}: {
  data: { label: string; value: number }[];
  refunds?: number[];
  height?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!data?.length) return (
    <div className="flex items-center justify-center text-gray-200 text-sm" style={{ height }}>
      Ma'lumot yo'q
    </div>
  );

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const W = 600, H = height, pad = 24, barW = Math.max(4, Math.floor((W - pad * 2) / data.length - 4));

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ height: height + 20 }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f}
          x1={pad} y1={H - f * (H - pad)} x2={W - pad} y2={H - f * (H - pad)}
          stroke="#f3f4f6" strokeWidth="1" />
      ))}
      {data.map((d, i) => {
        const x   = pad + i * ((W - pad * 2) / data.length) + ((W - pad * 2) / data.length - barW) / 2;
        const barH = Math.max(2, (d.value / maxVal) * (H - pad));
        const y    = H - barH;
        const refH = refunds?.[i] ? Math.max(2, (refunds[i] / maxVal) * (H - pad)) : 0;
        const isHov = hovered === i;

        return (
          <g key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}>
            {/* Main bar */}
            <rect x={x} y={y} width={barW} height={barH} rx="3"
              fill={isHov ? "#4f46e5" : "url(#barGrad)"} opacity={isHov ? 1 : 0.85} />
            {/* Refund overlay */}
            {refH > 0 && (
              <rect x={x} y={H - refH} width={barW} height={refH} rx="2"
                fill="#ef4444" opacity="0.5" />
            )}
            {/* Tooltip */}
            {isHov && (
              <g>
                <rect x={x - 20} y={y - 36} width={barW + 40} height={28} rx="6" fill="#1f2937" />
                <text x={x + barW / 2} y={y - 17} textAnchor="middle" fontSize="10" fill="white" fontWeight="600">
                  {fmt(d.value)}
                </text>
                {refH > 0 && (
                  <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="8" fill="#fca5a5">
                    -{fmt(refunds![i])}
                  </text>
                )}
              </g>
            )}
            {/* X label */}
            <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize="9" fill="#9ca3af">
              {d.label}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Trend Badge ────────────────────────────────────────────────
function Trend({ current, prev }: { current: number; prev?: number }) {
  if (!prev || prev === 0) return null;
  const d = ((current - prev) / prev) * 100;
  const abs = Math.abs(d).toFixed(1);
  if (Math.abs(d) < 0.5) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
      <Minus size={10} /> 0%
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
      d > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
    }`}>
      {d > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {abs}%
    </span>
  );
}

// ── KPI Card ───────────────────────────────────────────────────
function KpiCard({ label, main, sub, icon: Icon, iconCls, trend }: {
  label: string; main: string; sub?: string;
  icon: any; iconCls: string; trend?: { current: number; prev?: number };
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconCls}`}>
          <Icon size={16} />
        </div>
        {trend && <Trend current={trend.current} prev={trend.prev} />}
      </div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">{main}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Horizontal bar ─────────────────────────────────────────────
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

// ── Donut Chart ────────────────────────────────────────────────
function Donut({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="text-center text-gray-300 text-xs py-4">Ma'lumot yo'q</div>;

  const r = 52, cx = 60, cy = 60, sw = 16;
  const circ = 2 * Math.PI * r;
  let cum = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={120} height={120} viewBox="0 0 120 120" className="flex-shrink-0">
        {slices.filter(s => s.value > 0).map((s, i) => {
          const frac  = s.value / total;
          const dash  = frac * circ;
          const off   = circ - cum * circ;
          cum += frac;
          return (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={off}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">Jami</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#111827">
          {fmt(total)}
        </text>
      </svg>
      <div className="flex-1 space-y-2 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-gray-600 truncate flex-1">{s.label}</span>
            <span className="text-xs font-bold text-gray-800">{pct(s.value, total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export function StatisticsPage() {
  const [range, setRange] = useState<TimeRange>("monthly");

  const rangeLabels: Record<TimeRange, string> = {
    daily: "Bugun", weekly: "Hafta", monthly: "Oy", yearly: "Yil",
  };

  // ── Joriy davr ──
  const { data: cur, isLoading: curLoading } = useQuery({
    queryKey: ["stats-summary", range],
    queryFn: () => statisticsApi.getSummary(range),
    staleTime: 60_000,
  });

  // ── O'tgan davr (trend uchun) ──
  const prevRange = range === "daily" ? "daily" : range === "weekly" ? "weekly" : range === "monthly" ? "monthly" : "yearly";
  const { data: prev } = useQuery({
    queryKey: ["stats-prev", range],
    queryFn: async () => {
      // O'tgan davr uchun referenceDate hisolab berish
      const now   = new Date();
      const delta = range === "daily" ? 1 : range === "weekly" ? 7 : range === "monthly" ? 30 : 365;
      const prevDate = new Date(now.getTime() - delta * 86400_000);
      const res = await api.get("/statistics", {
        params: { period: prevRange, referenceDate: prevDate.toISOString() },
      });
      return res.data;
    },
    staleTime: 300_000,
  });

  // ── Bugungi sana uchun product & category performance ──
  const today = new Date().toISOString().slice(0, 10);
  const perfStart = range === "yearly"
    ? `${new Date().getFullYear()}-01-01T00:00:00`
    : range === "monthly"
    ? `${today.slice(0, 7)}-01T00:00:00`
    : range === "weekly"
    ? (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString(); })()
    : `${today}T00:00:00`;
  const perfEnd = `${today}T23:59:59`;

  const { data: products } = useQuery({
    queryKey: ["stats-products", range],
    queryFn: () => api.get("/statistics/product-performance", {
      params: { startDate: perfStart, endDate: perfEnd, limit: 10 },
    }).then(r => r.data),
    staleTime: 120_000,
  });

  const { data: categories } = useQuery({
    queryKey: ["stats-categories", range],
    queryFn: () => api.get("/statistics/category-performance", {
      params: { startDate: perfStart, endDate: perfEnd },
    }).then(r => r.data),
    staleTime: 120_000,
  });

  // ── Yillik oylik trend ──
  const { data: monthly } = useQuery({
    queryKey: ["stats-monthly", new Date().getFullYear()],
    queryFn: () => api.get("/statistics/monthly-breakdown", {
      params: { year: new Date().getFullYear() },
    }).then(r => r.data),
    staleTime: 300_000,
  });

  // ── Hisob-kitoblar ──
  const revenue     = safeNumber(cur?.revenue);
  const realRevenue = safeNumber(cur?.realRevenue ?? cur?.revenue);
  const profit      = safeNumber(cur?.realProfit  ?? cur?.profit);
  const orders      = safeNumber(cur?.ordersCount);
  const refunds     = safeNumber(cur?.totalRefunds);
  const refundCount = safeNumber(cur?.refundCount);
  const avgOrder    = orders > 0 ? revenue / orders : 0;
  const margin      = realRevenue > 0 ? Math.round((profit / realRevenue) * 100) : 0;

  const prevRevenue = safeNumber(prev?.totalRevenue);
  const prevProfit  = safeNumber(prev?.netProfit);
  const prevOrders  = safeNumber(prev?.totalSales);

  const chartData = useMemo(() => cur?.chartData || [], [cur]);
  const chartRefunds = useMemo(
    () => (cur?.chartData || []).map((d: any) => d.refunds || 0),
    [cur],
  );

  if (curLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );

  const maxProdRev = Math.max(...(products || []).map((p: any) => p.totalRevenue), 1);
  const maxCatRev  = Math.max(...(categories || []).map((c: any) => c.totalRevenue), 1);

  const CAT_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4","#f97316"];

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Savdo tahlili</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("uz-UZ", { day:"numeric", month:"long", year:"numeric" })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm gap-0.5">
          {(["daily","weekly","monthly","yearly"] as TimeRange[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === r ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"
              }`}>
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row 1 — asosiy ko'rsatkichlar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Haqiqiy tushum"
          main={fmt(realRevenue)}
          sub={refunds > 0 ? `Qaytarishlar: -${fmt(refunds)}` : "Qaytarish yo'q"}
          icon={DollarSign} iconCls="bg-indigo-50 text-indigo-600"
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
          icon={ShoppingBag} iconCls="bg-blue-50 text-blue-600"
          trend={{ current: orders, prev: prevOrders }}
        />
        <KpiCard
          label="Qaytarishlar"
          main={`${refundCount} ta`}
          sub={refundCount > 0 ? fmt(refunds) : "Hammasi yaxshi"}
          icon={RotateCcw}
          iconCls={refundCount > 0 ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-400"}
        />
      </div>

      {/* ── KPI Row 2 — to'lov taqsimoti ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Naqd pul", value: cur?.paymentSplit?.cash, color: "#10b981", bg: "bg-green-50", tc: "text-green-700" },
          { label: "Plastik karta", value: cur?.paymentSplit?.card, color: "#3b82f6", bg: "bg-blue-50", tc: "text-blue-700" },
          { label: "Nasiya", value: cur?.paymentSplit?.debt, color: "#ef4444", bg: "bg-red-50", tc: "text-red-600" },
        ].map(({ label, value, color, tc }) => {
          const v = safeNumber(value);
          return (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 font-medium">{label}</span>
                <span className="text-xs text-gray-400">{pct(v, revenue)}</span>
              </div>
              <p className={`text-lg font-bold ${tc}`}>{fmt(v)}</p>
              <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all"
                  style={{ width: pct(v, revenue), background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Asosiy grafik ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">Tushum dinamikasi</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {rangeLabels[range]} · Ko'k = tushum, Qizil = qaytarishlar
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Tushum
            </span>
            {chartRefunds.some((v: number) => v > 0) && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-red-400 inline-block opacity-60" /> Qaytarishlar
              </span>
            )}
          </div>
        </div>
        <BarChart data={chartData} refunds={chartRefunds} height={200} />
      </div>

      {/* ── Mahsulot + Kategoriya ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top mahsulotlar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={15} className="text-indigo-500" />
            <h3 className="font-bold text-gray-900 text-sm">Top mahsulotlar</h3>
            <span className="text-xs text-gray-400 ml-auto">{rangeLabels[range]}</span>
          </div>
          {!products?.length ? (
            <div className="text-center text-gray-300 text-sm py-6">Ma'lumot yo'q</div>
          ) : (
            <div className="space-y-3">
              {products.slice(0, 8).map((p: any, i: number) => {
                const m = safeNumber(p.profitMargin);
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                        i === 0 ? "bg-amber-100 text-amber-700"
                        : i === 1 ? "bg-gray-200 text-gray-600"
                        : i === 2 ? "bg-orange-100 text-orange-600"
                        : "bg-gray-50 text-gray-400"
                      }`}>{i + 1}</span>
                      <span className="text-xs font-medium text-gray-800 flex-1 truncate">{p.productName}</span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                        m >= 20 ? "bg-green-50 text-green-600"
                        : m >= 0 ? "bg-amber-50 text-amber-600"
                        : "bg-red-50 text-red-500"
                      }`}>{m}%</span>
                      <span className="text-xs font-bold text-indigo-600 w-16 text-right">{fmt(p.totalRevenue)}</span>
                    </div>
                    <div className="pl-7">
                      <HBar value={p.totalRevenue} max={maxProdRev} color={i < 3 ? "#6366f1" : "#a5b4fc"} />
                    </div>
                    <div className="pl-7 flex gap-3 text-xs text-gray-400">
                      <span>{fmtN(p.totalQuantitySold)} ta sotildi</span>
                      <span>·</span>
                      <span>{p.salesCount} savdo</span>
                      <span>·</span>
                      <span>Foyda: {fmt(p.totalProfit)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Kategoriyalar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={15} className="text-amber-500" />
            <h3 className="font-bold text-gray-900 text-sm">Kategoriyalar</h3>
            <span className="text-xs text-gray-400 ml-auto">{rangeLabels[range]}</span>
          </div>

          {!categories?.length ? (
            <div className="text-center text-gray-300 text-sm py-6">Ma'lumot yo'q</div>
          ) : (
            <>
              {/* Donut */}
              <div className="mb-5">
                <Donut slices={(categories || []).slice(0, 5).map((c: any, i: number) => ({
                  label: c.categoryName, value: c.totalRevenue, color: CAT_COLORS[i],
                }))} />
              </div>
              {/* Jadval */}
              <div className="space-y-2.5">
                {categories.slice(0, 6).map((c: any, i: number) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: CAT_COLORS[i] ?? "#e5e7eb" }} />
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">{c.categoryName}</span>
                      <span className={`text-xs font-semibold ${marginColor(c.profitMargin)}`}>
                        {c.profitMargin}%
                      </span>
                      <span className="text-xs font-bold text-gray-800 w-16 text-right">{fmt(c.totalRevenue)}</span>
                    </div>
                    <div className="pl-4">
                      <HBar value={c.totalRevenue} max={maxCatRev} color={CAT_COLORS[i] ?? "#e5e7eb"} />
                    </div>
                    <div className="pl-4 flex gap-3 text-xs text-gray-400">
                      <span>{c.totalSales} savdo</span>
                      <span>·</span>
                      <span>Foyda: {fmt(c.totalProfit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Oylik trend (yillik panorama) ── */}
      {monthly?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={15} className="text-indigo-500" />
            <h3 className="font-bold text-gray-900 text-sm">{new Date().getFullYear()} — oylik panorama</h3>
          </div>
          <p className="text-xs text-gray-400 mb-4">Har oy uchun tushum va qaytarishlar</p>
          <BarChart
            data={monthly.map((m: any) => ({ label: m.label, value: m.totalRevenue }))}
            refunds={monthly.map((m: any) => m.totalRefunds || 0)}
            height={160}
          />

          {/* Oylik jadval */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-400 font-medium">Oy</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Tushum</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Haqiqiy</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Foyda</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Savdo</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Qaytarish</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m: any, i: number) => {
                  const isCurrentMonth = i === new Date().getMonth();
                  const mMargin = m.totalRevenue > 0
                    ? Math.round((m.netProfit / m.totalRevenue) * 100)
                    : 0;
                  return (
                    <tr key={i} className={`border-b border-gray-50 ${isCurrentMonth ? "bg-indigo-50/50" : ""}`}>
                      <td className={`py-2 font-medium ${isCurrentMonth ? "text-indigo-700" : "text-gray-700"}`}>
                        {m.label} {isCurrentMonth && <span className="text-xs bg-indigo-100 text-indigo-600 px-1 rounded ml-1">joriy</span>}
                      </td>
                      <td className="text-right py-2 text-gray-700 font-semibold">{fmt(m.totalRevenue)}</td>
                      <td className="text-right py-2 text-gray-700">{fmt(m.realRevenue)}</td>
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
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="py-2 font-bold text-gray-800">Jami</td>
                  <td className="text-right py-2 font-bold text-gray-900">
                    {fmt(monthly.reduce((s: number, m: any) => s + m.totalRevenue, 0))}
                  </td>
                  <td className="text-right py-2 font-bold text-gray-900">
                    {fmt(monthly.reduce((s: number, m: any) => s + m.realRevenue, 0))}
                  </td>
                  <td className="text-right py-2 font-bold text-green-700">
                    {fmt(monthly.reduce((s: number, m: any) => s + m.netProfit, 0))}
                  </td>
                  <td className="text-right py-2 font-bold text-gray-800">
                    {monthly.reduce((s: number, m: any) => s + m.totalSales, 0)} ta
                  </td>
                  <td className="text-right py-2 font-bold text-red-500">
                    {(() => {
                      const t = monthly.reduce((s: number, m: any) => s + (m.totalRefunds || 0), 0);
                      return t > 0 ? `-${fmt(t)}` : "—";
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Margin tahlili ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Percent size={15} className="text-purple-500" />
          <h3 className="font-bold text-gray-900 text-sm">Margin tahlili</h3>
          <span className="text-xs text-gray-400 ml-auto">{rangeLabels[range]}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Umumiy margin</p>
            <p className={`text-3xl font-black ${marginColor(margin)}`}>{margin}%</p>
            <p className="text-xs text-gray-400 mt-1">
              {margin >= 20 ? "🟢 Yaxshi" : margin >= 10 ? "🟡 O'rtacha" : "🔴 Past"}
            </p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Brutto foyda</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(safeNumber(cur?.profit))}</p>
            <p className="text-xs text-gray-400 mt-1">qaytarishsiz</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Sof foyda</p>
            <p className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>{fmt(profit)}</p>
            <p className="text-xs text-gray-400 mt-1">qaytarishlar ayirilgan</p>
          </div>
        </div>

        {/* Kategoriya margin jadvali */}
        {categories?.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Kategoriya bo'yicha margin
            </p>
            {categories.slice(0, 6).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-28 truncate flex-shrink-0">{c.categoryName}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden relative">
                  <div
                    className="h-4 rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{
                      width: `${Math.min(Math.abs(c.profitMargin), 100)}%`,
                      background: c.profitMargin >= 20 ? "#10b981"
                        : c.profitMargin >= 0 ? "#f59e0b" : "#ef4444",
                      minWidth: c.profitMargin !== 0 ? "28px" : "0",
                    }}
                  >
                    <span className="text-white text-xs font-bold">{c.profitMargin}%</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-700 w-16 text-right">{fmt(c.totalRevenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}