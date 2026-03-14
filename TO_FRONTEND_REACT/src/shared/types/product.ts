// shared/types/product.ts — ProductFormValues ga unit + minStockLimit qo'shildi

export interface ProductFormValues {
  name: string;
  categoryId: string;
  purchasePrice: number;
  salePrice: number;
  unit: string;           // ✅ yangi
  stockQty: number;
  minStockLimit: number;  // ✅ yangi
  image: File | null;
}

export interface Product {
  id: string;
  name: string;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  purchasePrice: number;
  salePrice: number;
  unit: string;           // ✅ yangi
  imageUrl?: string | null;
  stockQuantity: number;
  minStockLimit: number;  // ✅ yangi
  createdAt: string;
  updatedAt: string;
}