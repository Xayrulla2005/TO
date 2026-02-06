import { Category } from './categoriy';

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  category?: Category;
  purchasePrice: number;
  salePrice: number;
  stockQty: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Form Data (Client Side)
export interface ProductFormValues {
  name: string;
  categoryId: string;
  purchasePrice: number;
  salePrice: number;
  stockQty: number;
  image?: File | null;
}