// ============================================================
// src/pages/ProductsPage.tsx
// ============================================================
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "../features/products/api/product.api";
import { useAuthStore } from "../features/auth/model/auth.store";
import { useDebounce } from "../shared/hooks/useDebounce";
import { Button } from "../shared/ui/Button";
import { Card } from "../shared/ui/Card";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../shared/ui/Table";
import { ProductFormModal } from "../features/products/ui/ProductFormModal";
import { Modal } from "../shared/ui/Modal";
import { Input } from "../shared/ui/Input";
import { Badge } from "../shared/ui/Badge";
import { toast } from "../shared/ui/Toast";
import { LoadingSpinner } from "../shared/ui/Loading";
import {
  Plus, Edit, Trash2, Search, Package,
  AlertTriangle, Download, ChevronLeft, ChevronRight,
} from "lucide-react";
import { formatCurrency } from "../shared/lib/utils";
import { Product } from "../shared/types/product";
import { api } from "../shared/lib/axios";

const UNIT_LABELS: Record<string, string> = {
  piece: "dona", meter: "metr", kg: "kg", litre: "litr", pack: "paket",
};
const PAGE_SIZE = 50;

async function exportProductsToExcel(products: Product[]) {
  const XLSX = await import("xlsx");
  const wsData = [
    ["#", "Mahsulot nomi", "Kategoriya", "O'lchov",
     "Kelish narxi ($)", "Sotuv narxi ($)", "Qoldiq", "Min chegara", "Holati", "Marja (%)"],
    ...products.map((p, i) => {
      const pur    = Number(p.purchasePrice);
      const sal    = Number(p.salePrice);
      const margin = pur > 0 ? Math.round(((sal - pur) / pur) * 100) : 0;
      const qty    = Number(p.stockQuantity);
      const min    = Number(p.minStockLimit ?? 0);
      const status = qty <= 0 ? "Tugagan" : qty <= min ? "Kam qoldiq" : "Mavjud";
      return [i + 1, p.name, p.category?.name ?? "Kategoriyasiz",
        UNIT_LABELS[p.unit] ?? p.unit ?? "dona",
        pur, sal, qty, min, status, `${margin}%`];
    }),
    ["JAMI", `${products.length} ta`, "", "", "", "",
     products.reduce((s, p) => s + Number(p.stockQuantity), 0), "",
     `${products.filter((p) => Number(p.stockQuantity) <= 0).length} tugagan`, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 5 }, { wch: 35 }, { wch: 18 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mahsulotlar");
  XLSX.writeFile(wb, `mahsulotlar_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success("Excel yuklab olindi");
}

export function ProductsPage() {
  const { user }    = useAuthStore();
  const isAdmin     = user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [search,         setSearch]         = useState("");
  const [page,           setPage]           = useState(1);
  const [isFormOpen,     setIsFormOpen]     = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  const [isExporting,    setIsExporting]    = useState(false);

  // ✅ 1. Faqat debouncedSearch API ga ketadi
  const debouncedSearch = useDebounce(search, 500);

  // ✅ 2. debouncedSearch o'zgarganda page ni reset — bitta render
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ── Data fetching ─────────────────────────────────────────
  const { data: response, isLoading, isError, refetch } = useQuery({
    queryKey:  ["products", page, debouncedSearch],
    queryFn:   () => productsApi.getAll(page, debouncedSearch || undefined),
    staleTime: 30_000, // 30 sekund — qidiruv natijasi tez eskiradi
    retry:     2,
    // ✅ 3. debouncedSearch bilan page sync bo'lguncha eski datani saqla
    placeholderData: (prev) => prev,
  });

  const products:  Product[] = useMemo(() => response?.data  ?? [], [response]);
  const total:     number    = useMemo(() => response?.total ?? 0,   [response]);
  const pageCount: number    = useMemo(
    () => response?.pageCount ?? Math.max(1, Math.ceil((response?.total ?? 0) / PAGE_SIZE)),
    [response],
  );

  // ── Handlers ──────────────────────────────────────────────
  // ✅ search o'zgarganda faqat search state — page reset useEffect da
  const handleSearch = useCallback((val: string) => setSearch(val), []);

  const handleOpenCreate = useCallback(() => {
    setEditingProduct(null);
    setIsFormOpen(true);
  }, []);

  const handleOpenEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingProduct(null);
  }, []);

  // ── Delete ────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: productsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Mahsulot o'chirildi");
      setDeletingId(null);
    },
    onError: () => toast.error("Mahsulotni o'chirishda xatolik"),
  });

  // ── Excel export ──────────────────────────────────────────
  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const { data } = await api.get("/products", {
        params: { page: 1, limit: 9999, ...(debouncedSearch ? { search: debouncedSearch } : {}) },
      });
      const raw = data?.data ?? data;
      const all: Product[] = Array.isArray(raw) ? raw : [];
      if (!all.length) { toast.error("Eksport qilish uchun mahsulot topilmadi"); return; }
      await exportProductsToExcel(all);
    } catch {
      toast.error("Yuklab olishda xatolik yuz berdi");
    } finally {
      setIsExporting(false);
    }
  }, [debouncedSearch]);

  // ── Computed ──────────────────────────────────────────────
  const lowStockCount   = products.filter(
    (p) => Number(p.stockQuantity) > 0 && Number(p.stockQuantity) <= Number(p.minStockLimit ?? 5),
  ).length;
  const outOfStockCount = products.filter((p) => Number(p.stockQuantity) <= 0).length;

  if (isLoading) return <LoadingSpinner className="h-96" />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Package size={40} className="text-gray-300" />
        <p className="text-sm text-gray-500">Ma&apos;lumotlarni yuklashda xatolik</p>
        <Button variant="outline" onClick={() => refetch()}>Qayta urinish</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mahsulotlar ombori</h1>
          <p className="text-gray-500 text-sm">
            {total} ta mahsulot
            {lowStockCount   > 0 && <span className="ml-2 text-amber-600 font-medium">· {lowStockCount} ta kam qoldiq</span>}
            {outOfStockCount > 0 && <span className="ml-2 text-red-600 font-medium">· {outOfStockCount} ta tugagan</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-all"
          >
            {isExporting
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Download size={15} />}
            Excel
          </button>
          {isAdmin && (
            <Button leftIcon={<Plus size={16} />} onClick={handleOpenCreate}>
              Mahsulot qo&apos;shish
            </Button>
          )}
        </div>
      </div>

      <Card>
        {/* Qidiruv */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative w-full sm:max-w-sm">
            <Input
              placeholder="Mahsulot yoki kategoriya bo'yicha qidirish..."
              icon={<Search size={16} />}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {/* Typing indicator — hali debounce kutilmoqda */}
            {search !== debouncedSearch && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
              </span>
            )}
          </div>
        </div>

        {/* Jadval */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mahsulot</TableHead>
                <TableHead>Kategoriya</TableHead>
                <TableHead>O&apos;lchov</TableHead>
                <TableHead>Kelish narxi</TableHead>
                <TableHead>Sotuv narxi</TableHead>
                <TableHead>Qoldiq</TableHead>
                <TableHead>Holati</TableHead>
                {isAdmin && <TableHead className="text-right">Amallar</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-12 text-gray-400">
                    <Package size={36} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">
                      {debouncedSearch ? `"${debouncedSearch}" bo'yicha mahsulot topilmadi` : "Mahsulot topilmadi"}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const qty       = Number(product.stockQuantity);
                  const min       = Number(product.minStockLimit ?? 5);
                  const isLow     = qty > 0 && qty <= min;
                  const isOut     = qty <= 0;
                  const unitLabel = UNIT_LABELS[product.unit] || product.unit || "";

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 flex-shrink-0">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <Package size={18} className="text-gray-400" />
                            )}
                          </div>
                          <span className="font-medium text-gray-900 min-w-0 truncate max-w-[180px]">{product.name}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-700">
                          {product.category?.name || "Kategoriyasiz"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-semibold">
                          {unitLabel || "dona"}
                        </span>
                      </TableCell>

                      <TableCell className="text-gray-600 tabular-nums">${formatCurrency(product.purchasePrice)}</TableCell>
                      <TableCell className="font-medium text-indigo-600 tabular-nums">${formatCurrency(product.salePrice)}</TableCell>

                      <TableCell>
                        {qty > 0 ? (
                          <span className={`font-medium tabular-nums ${isLow ? "text-amber-600" : "text-gray-700"}`}>
                            {parseFloat(String(qty))}{" "}
                            <span className="text-gray-400 text-xs font-normal">{unitLabel}</span>
                            {isLow && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
                          </span>
                        ) : (
                          <span className="text-red-500 font-semibold text-xs">Tugagan</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant={isOut ? "danger" : isLow ? "warning" : "success"}>
                          {isOut ? "Tugagan" : isLow ? "Kam qoldiq" : "Mavjud"}
                        </Badge>
                      </TableCell>

                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleOpenEdit(product)}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => setDeletingId(product.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total} ta
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
              {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
                let p: number;
                if      (pageCount <= 5)        p = i + 1;
                else if (page <= 3)             p = i + 1;
                else if (page >= pageCount - 2) p = pageCount - 4 + i;
                else                            p = page - 2 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      p === page ? "bg-indigo-600 text-white" : "hover:bg-gray-100 text-gray-600"
                    }`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
                <ChevronRight size={16} className="text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <ProductFormModal isOpen={isFormOpen} onClose={handleCloseForm} productToEdit={editingProduct} />

      <Modal isOpen={!!deletingId} onClose={() => setDeletingId(null)} title="O'chirishni tasdiqlash" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 bg-red-50 p-3 rounded-xl">
            <AlertTriangle size={22} />
            <p className="text-sm font-medium">Mahsulot o&apos;chirilsinmi?</p>
          </div>
          <p className="text-gray-600 text-sm">Bu amalni ortga qaytarib bo&apos;lmaydi.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Bekor qilish</Button>
            <Button variant="danger" isLoading={deleteMutation.isPending}
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}>
              O&apos;chirish
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}