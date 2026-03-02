// src/features/debts/hooks/useDebts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { debtsApi } from '../api/debts.api';
import type { CreateDebtDto, PayDebtDto } from '../../../shared/types/debt.types';
import { toast } from '../../../shared/ui/Toast';

export const useDebts = () => {
  return useQuery({
    queryKey: ['debts'],
    queryFn: debtsApi.getAll,
  });
};

export const useDebt = (id: string) => {
  return useQuery({
    queryKey: ['debt', id],
    queryFn: () => debtsApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateDebt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateDebtDto) => debtsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast.success('Qarz muvaffaqiyatli ro\'yxatga olindi');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Xatolik yuz berdi');
    },
  });
};

export const usePayDebt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: PayDebtDto }) =>
      debtsApi.payDebt(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast.success('To\'lov muvaffaqiyatli amalga oshirildi');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Xatolik yuz berdi');
    },
  });
};