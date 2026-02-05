import axios from 'axios';

export const categoriesService = {
  async list(params: { page?: number; limit?: number }) {
    const { data } = await axios.get('/api/categories', { params });
    return data;
  },

  async create(payload: any) {
    const { data } = await axios.post('/api/categories', payload);
    return data;
  },

  async update(id: string, payload: any) {
    const { data } = await axios.put(`/api/categories/${id}`, payload);
    return data;
  },

  async remove(id: string) {
    const { data } = await axios.delete(`/api/categories/${id}`);
    return data;
  },
};
