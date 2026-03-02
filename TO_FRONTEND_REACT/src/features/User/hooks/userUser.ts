// src/features/User/hooks/userUser.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/user.api';
import type { CreateUserDto, UpdateUserDto } from '../types/user.types';
import { toast } from '../../../shared/ui/Toast';

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Foydalanuvchi muvaffaqiyatli qo\'shildi!');
    },
    onError: (error: any) => {
      console.error('Create user error:', error);
      
      // ✅ Backend validation xatolarini parse qilish
      if (error?.response?.data?.message) {
        const backendMessage = error.response.data.message;
        
        if (Array.isArray(backendMessage)) {
          // Validation xatolari array bo'lsa
          const messages = backendMessage
            .map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.constraints) return Object.values(err.constraints).join(', ');
              return JSON.stringify(err);
            })
            .join('\n');
          
          toast.error(messages);
        } else {
          toast.error(backendMessage);
        }
      } else {
        toast.error('Foydalanuvchi qo\'shishda xatolik yuz berdi');
      }
    }, // ✅ Bu vergul qo'shildi
  }); // ✅ Bu qavs qo'shildi
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      usersApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Foydalanuvchi muvaffaqiyatli yangilandi!');
    },
    onError: (error: any) => {
      console.error('Update user error:', error);
      
      // ✅ Backend validation xatolarini parse qilish
      if (error?.response?.data?.message) {
        const backendMessage = error.response.data.message;
        
        if (Array.isArray(backendMessage)) {
          const messages = backendMessage
            .map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.constraints) return Object.values(err.constraints).join(', ');
              return JSON.stringify(err);
            })
            .join('\n');
          
          toast.error(messages);
        } else {
          toast.error(backendMessage);
        }
      } else {
        toast.error('Foydalanuvchini yangilashda xatolik');
      }
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Foydalanuvchi muvaffaqiyatli o\'chirildi!');
    },
    onError: (error: any) => {
      console.error('Delete user error:', error);
      
      if (error?.response?.data?.message) {
        const backendMessage = error.response.data.message;
        
        if (Array.isArray(backendMessage)) {
          const messages = backendMessage
            .map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.constraints) return Object.values(err.constraints).join(', ');
              return JSON.stringify(err);
            })
            .join('\n');
          
          toast.error(messages);
        } else {
          toast.error(backendMessage);
        }
      } else {
        toast.error('Foydalanuvchini o\'chirishda xatolik');
      }
    },
  });
};