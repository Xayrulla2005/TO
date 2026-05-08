// src/features/products/api/product.api.ts
import { api } from "../../../shared/lib/axios";
import { Product, ProductFormValues } from "../../../shared/types/product";

// ── Backend URL (rasm uchun) ──────────────────────────────────
const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.replace("/api/v1", "") ||
  (import.meta as any).env?.VITE_API_BASE_URL?.replace("/api/v1", "") ||
  "http://localhost:4002";

// imageUrl ni to'liq URL ga aylantirish
// Backend /uploads/products/file.jpg qaytaradi — prefix kerak
function fixImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Backend PaginatedResponseDto: { data: [], meta: { totalItems, totalPages } }
export interface ProductsResponse {
  data:      Product[];
  total:     number;
  page:      number;
  pageCount: number;
}

function normalizeResponse(raw: any): ProductsResponse {
  const fix = (p: any) => ({ ...p, imageUrl: fixImageUrl(p.imageUrl) });

  // { data: [], meta: { totalItems, totalPages } }
  if (raw?.meta && Array.isArray(raw?.data)) {
    return {
      data:      raw.data.map(fix),
      total:     raw.meta.totalItems ?? raw.data.length,
      page:      raw.meta.page       ?? 1,
      pageCount: raw.meta.totalPages ?? 1,
    };
  }
  // { data: [], total: N }
  if (Array.isArray(raw?.data)) {
    const total = raw.total ?? raw.data.length;
    return {
      data:      raw.data.map(fix),
      total,
      page:      raw.page      ?? 1,
      pageCount: raw.pageCount ?? Math.ceil(total / 50),
    };
  }
  // direct array
  if (Array.isArray(raw)) {
    const data = raw.map(fix);
    return { data, total: data.length, page: 1, pageCount: 1 };
  }
  return { data: [], total: 0, page: 1, pageCount: 1 };
}

export const productsApi = {
  // ProductsPage uchun — pagination bilan
  getAll: async (page = 1, search?: string): Promise<ProductsResponse> => {
    const { data } = await api.get("/products", {
      params: { page, limit: 50, ...(search ? { search } : {}) },
    });
    return normalizeResponse(data);
  },

  // SalesPage uchun — barcha mahsulotlar (limit: 1000)
  getAllForSales: async (): Promise<Product[]> => {
    const { data } = await api.get("/products", {
      params: { page: 1, limit: 1000 },
    });
    return normalizeResponse(data).data;
  },

  getOne: async (id: string): Promise<Product> => {
    const { data } = await api.get<any>(`/products/${id}`);
    const p = data?.data ?? data;
    return { ...p, imageUrl: fixImageUrl(p.imageUrl) };
  },

  create: async (values: ProductFormValues): Promise<Product> => {
    const form = new FormData();
    form.append("name",          values.name);
    form.append("purchasePrice", String(values.purchasePrice));
    form.append("salePrice",     String(values.salePrice));
    form.append("unit",          values.unit || "piece");
    if (values.categoryId  != null) form.append("categoryId",    values.categoryId);
    if (values.stockQty    != null) form.append("stockQuantity",  String(values.stockQty));
    if (values.minStockLimit != null) form.append("minStockLimit", String(values.minStockLimit));
    if (values.image)               form.append("image",          values.image);

    const { data } = await api.post<any>("/products", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const p = data?.data ?? data;
    return { ...p, imageUrl: fixImageUrl(p.imageUrl) };
  },

  update: async (id: string, values: Partial<ProductFormValues>): Promise<Product> => {
    const form = new FormData();
    if (values.name          != null) form.append("name",          values.name);
    if (values.categoryId !== undefined) form.append("categoryId", values.categoryId ?? "");
    if (values.purchasePrice != null) form.append("purchasePrice", String(values.purchasePrice));
    if (values.salePrice     != null) form.append("salePrice",     String(values.salePrice));
    if (values.unit          != null) form.append("unit",          values.unit);
    if (values.stockQty      != null) form.append("stockQuantity", String(values.stockQty));
    if (values.minStockLimit != null) form.append("minStockLimit", String(values.minStockLimit));
    if (values.image)                 form.append("image",         values.image);

    const { data } = await api.put<any>(`/products/${id}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const p = data?.data ?? data;
    return { ...p, imageUrl: fixImageUrl(p.imageUrl) };
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`);
  },
};