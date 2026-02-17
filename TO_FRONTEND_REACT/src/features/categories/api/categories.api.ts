import { api } from '@/shared/lib/axios';
import { Category, CreateCategoryDto, UpdateCategoryDto } from '../../../shared/types/categoriy';

export const categoriesApi = {
  getAll: async () => {
    const { data } = await api.get('/categories');
    // ✅ FIX 1: Backend {data: [...]} yoki to'g'ridan array qaytarishi mumkin
    return Array.isArray(data) ? data : (data.data ?? []);
  },

  create: async (payload: CreateCategoryDto) => {
    const { data } = await api.post<Category>('/categories', payload);
    return data;
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