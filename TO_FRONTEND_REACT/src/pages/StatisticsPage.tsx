import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { statisticsApi } from "../features/statistics/api/statistics.api";
import { Card, CardHeader, CardTitle, CardContent } from "../shared/ui/Card";
import { LoadingSpinner } from "../shared/ui/Loading";
import { formatCurrency, safeNumber } from "../shared/lib/utils";
import { TimeRange } from "../shared/types/statistics";
import {
  ArrowUpRight,
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
} from "lucide-react";

function SimpleBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  if (!data || data.length === 0)
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No Data
      </div>
    );

  const maxValue = Math.max(...data.map((d) => d.value)) * 1.1; // 10% headroom

  return (
    <div className="flex items-end justify-between h-full gap-2 pt-6">
      {data.map((point, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col items-center gap-2 group h-full justify-end"
        >
          <div className="relative w-full flex justify-center items-end h-[80%]">
            <div
              className="w-full max-w-[40px] bg-indigo-500 rounded-t-sm hover:bg-indigo-600 transition-all relative group-hover:opacity-90"
              style={{ height: `${(point.value / maxValue) * 100}%` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {formatCurrency(point.value)}
              </div>
            </div>
          </div>
          <span className="text-xs text-gray-500 rotate-0 truncate max-w-[60px]">
            {point.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StatisticsPage() {
  const [range, setRange] = useState<TimeRange>("daily");

  const { data, isLoading } = useQuery({
    queryKey: ["statistics-summary", range],
    queryFn: () => statisticsApi.getSummary(range),
  });

  if (isLoading) return <LoadingSpinner className="h-96" />;

  const chartData = data?.chartData || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Biznes </h1>
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm inline-flex">
          {(["daily", "weekly", "monthly", "yearly"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                range === r
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Jami tushum</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(safeNumber(data?.revenue))}
              </h3>
            </div>
            <div className="h-12 w-12 bg-green-50 rounded-full flex items-center justify-center text-green-600">
              <TrendingUp size={24} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Sof foyda</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(safeNumber(data?.profit))}
              </h3>
            </div>
            <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
              <ArrowUpRight size={24} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Buyurtmalar soni
              </p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">
                {safeNumber(data?.ordersCount)}
              </h3>
            </div>
            <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <BarChart3 size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 min-h-[400px]">
          <CardHeader>
            <CardTitle>Tushum dinamikasi</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <SimpleBarChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon size={18} /> Tolovlar taqsimoti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              {
                label: "Naqd",
                value: safeNumber(data?.paymentSplit.cash),
                color: "bg-green-500",
              },
              {
                label: "Karta",
                value: safeNumber(data?.paymentSplit.card),
                color: "bg-blue-500",
              },
              {
                label: "Qarz",
                value: safeNumber(data?.paymentSplit.debt),
                color: "bg-red-500",
              },
            ].map((item) => {
              const total = safeNumber(data?.revenue) || 1; // Prevent division by zero
              const percent = Math.round((item.value / total) * 100);
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">
                      {item.label}
                    </span>
                    <span className="text-gray-500">
                      {percent}% ({formatCurrency(item.value)})
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${item.color}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
