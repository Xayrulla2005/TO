import { api } from "../../../shared/lib/axios";
import { Product, ProductFormValues } from "../../../shared/types/product";

export const productsApi = {
  getAll: async () => {
    const { data } = await api.get("/products", { params: { limit: 1000 } });
    return data.data;
  },

  getOne: async (id: string) => {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },

  create: async (values: ProductFormValues) => {
    const formData = new FormData();
    formData.append("name", values.name);
    formData.append("purchasePrice", values.purchasePrice.toString());
    formData.append("salePrice", values.salePrice.toString());
    formData.append("unit", values.unit || "piece");
    if (values.categoryId)   formData.append("categoryId", values.categoryId);
    if (values.stockQty !== undefined)
      formData.append("stockQuantity", values.stockQty.toString());
    if (values.minStockLimit !== undefined)
      formData.append("minStockLimit", values.minStockLimit.toString());
    if (values.image)        formData.append("image", values.image);

    const { data } = await api.post<Product>("/products", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  update: async (id: string, values: Partial<ProductFormValues>) => {
    const formData = new FormData();
    if (values.name)                    formData.append("name", values.name);
    if (values.categoryId !== undefined) formData.append("categoryId", values.categoryId);
    if (values.purchasePrice !== undefined)
      formData.append("purchasePrice", values.purchasePrice.toString());
    if (values.salePrice !== undefined)
      formData.append("salePrice", values.salePrice.toString());
    if (values.unit)                    formData.append("unit", values.unit);
    if (values.stockQty !== undefined)
      formData.append("stockQuantity", values.stockQty.toString());
    if (values.minStockLimit !== undefined)
      formData.append("minStockLimit", values.minStockLimit.toString());
    if (values.image)                   formData.append("image", values.image);

    const { data } = await api.put<Product>(`/products/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/products/${id}`);
  },
};