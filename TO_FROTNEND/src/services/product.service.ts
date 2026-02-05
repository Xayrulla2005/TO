import apiClient from './api';
import type { PaginationParams } from '../types/models';

export const productsService = {
  async list(params: PaginationParams = {}) {
    const response = await apiClient.get('/products', { params });
    return response.data;
  },

  async getById(id: string) {
    const response = await apiClient.get(`/products/${id}`);
    return response.data.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/products', data);
    return response.data.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/products/${id}`, data);
    return response.data.data;
  },

  async delete(id: string) {
    await apiClient.delete(`/products/${id}`);
  },
};
