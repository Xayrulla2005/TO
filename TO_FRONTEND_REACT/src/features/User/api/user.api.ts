// src/features/User/api/user.api.ts
import { api } from '../../../shared/lib/axios';
import type { User, CreateUserDto, UpdateUserDto } from '../types/user.types';

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const { data } = await api.get('/users');

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.users)) return data.users;
    if (Array.isArray(data?.items)) return data.items;

    return [];
  },

  create: async (dto: CreateUserDto): Promise<User> => {
    const { data } = await api.post('/users', {
      fullName: dto.fullName,
      phone: dto.phone,
      password: dto.password,
      role: dto.role || 'SALER',
      isActive: dto.isActive ?? true,
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