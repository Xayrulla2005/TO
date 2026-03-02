// src/features/User/api/user.api.ts
import axios from 'axios';
import type { User, CreateUserDto, UpdateUserDto } from '../types/user.types';

const API_BASE = 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token qo'shish (interceptor)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const { data } = await api.get('/users');

    // ✅ Backend turli formatda qaytarishi mumkin — hammasini handle qilamiz
    console.log('📦 Users API response:', data);

    if (Array.isArray(data)) {
      return data; // [ {...}, {...} ]
    }

    if (Array.isArray(data?.data)) {
      return data.data; // { data: [...] }
    }

    if (Array.isArray(data?.users)) {
      return data.users; // { users: [...] }
    }

    if (Array.isArray(data?.items)) {
      return data.items; // { items: [...] }
    }

    console.warn('⚠️ Kutilmagan response format:', data);
    return [];
  },

  create: async (dto: CreateUserDto): Promise<User> => {
    const { data } = await api.post('/users', {
      fullName: dto.fullName,
      phone: dto.phone,
      password: dto.password,
      role: dto.role || 'SALER',
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
    return data;
  },

  update: async (id: string, dto: UpdateUserDto): Promise<User> => {
    const { data } = await api.patch(`/users/${id}`, dto);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};