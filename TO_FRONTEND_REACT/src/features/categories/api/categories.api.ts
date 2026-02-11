import { api } from '@/shared/lib/axios';
import { Category, CreateCategoryDto, UpdateCategoryDto } from '../../../shared/types/categoriy';

export const categoriesApi = {
  getAll: async () => {
    const { data } = await api.get('/categories');
    
    // Backend paginated response qaytarsa (products bilan bir xil):
    return data.data; // Array qaytaradi
  },
  create: async (payload: CreateCategoryDto) => {
    const { data } = await api.post<Category>('/categories', payload);
    return data;
  },
  update: async (id: string, payload: UpdateCategoryDto) => {
    const { data } = await api.patch<Category>(`/categories/${id}`, payload);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/categories/${id}`);
  },
};