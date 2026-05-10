import { api } from '../../../shared/lib/axios';
import { Category, CreateCategoryDto, UpdateCategoryDto } from '../../../shared/types/categoriy';

export const categoriesApi = {
  getAll: async () => {
    const { data } = await api.get('/categories', { params: { limit: 9999 } });
    return Array.isArray(data) ? data : (data.data ?? []);
  },

  create: async (payload: CreateCategoryDto) => {
  try {
    const { data } = await api.post('/categories', payload);
    return data;
  } catch (error: any) {
    const serverMessage =
      error?.response?.data?.message?.message ??
      error?.response?.data?.message ??
      'Xatolik yuz berdi';

    throw new Error(serverMessage);
  }
},

  // ✅ FIX 2: patch → put (Backend @Put ishlatayapti, @Patch emas!)
  update: async (id: string, payload: UpdateCategoryDto) => {
    const { data } = await api.put<Category>(`/categories/${id}`, payload);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/categories/${id}`);
  },
};