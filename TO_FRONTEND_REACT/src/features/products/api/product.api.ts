import { api } from "../../../shared/lib/axios";
import { Product, ProductFormValues } from "../../../shared/types/product";

export const productsApi = {
  getAll: async () => {
    const { data } = await api.get("/products");

    // Paginated response
    return data.data; // Array qaytaradi
  },
  getOne: async (id: string) => {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },
  create: async (values: ProductFormValues) => {
    const formData = new FormData();
    formData.append("name", values.name);
    formData.append("categoryId", values.categoryId);
    formData.append("purchasePrice", values.purchasePrice.toString());
    formData.append("salePrice", values.salePrice.toString());
    formData.append("stockQuantity", values.stockQty.toString());
    if (values.image) {
      formData.append("image", values.image);
    }

    const { data } = await api.post<Product>("/products", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  update: async (id: string, values: Partial<ProductFormValues>) => {
    const formData = new FormData();
    if (values.name) formData.append("name", values.name);
    if (values.categoryId) {
      formData.append("categoryId", values.categoryId);
    }
    if (values.purchasePrice !== undefined)
      formData.append("purchasePrice", values.purchasePrice.toString());
    if (values.salePrice !== undefined)
      formData.append("salePrice", values.salePrice.toString());
    if (values.stockQty !== undefined) {
      formData.append("stockQuantity", values.stockQty.toString());
    }
    if (values.image) {
      formData.append("image", values.image);
    }

    const { data } = await api.put<Product>(`/products/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/products/${id}`);
  },
};
