// src/features/User/hooks/userUser.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/user.api';
import type { CreateUserDto, UpdateUserDto } from '../types/user.types';
import { toast } from '../../../shared/ui/Toast';

function parseError(error: any): string {
  const msg = error?.response?.data?.message;
  if (!msg) return 'Xatolik yuz berdi';
  if (Array.isArray(msg)) {
    return msg.map((e: any) =>
      typeof e === 'string' ? e :
      e.constraints ? Object.values(e.constraints).join(', ') :
      JSON.stringify(e)
    ).join('\n');
  }
  return String(msg);
}

// ✅ staleTime: 10 daqiqa — foydalanuvchilar ro'yxati tez-tez o'zgarmaydi
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn:  usersApi.getAll,
    staleTime: 10 * 60_000,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("Foydalanuvchi muvaffaqiyatli qo'shildi!");
    },
    onError: (error: any) => toast.error(parseError(error)),
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) => usersApi.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Foydalanuvchi muvaffaqiyatli yangilandi!');
    },
    onError: (error: any) => toast.error(parseError(error)),
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("Foydalanuvchi muvaffaqiyatli o'chirildi!");
    },
    onError: (error: any) => toast.error(parseError(error)),
  });
};