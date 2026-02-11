import { ReactNode } from 'react';
import { Category } from './categoriy'

export interface Product {
  stockQty: ReactNode;
  id: string;
  name: string;
  categoryId: string;
  category?: Category;
  purchasePrice: number;
  salePrice: number;
  stockQuantity: number;
minStockLimit: number;
isLowStock: boolean;
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