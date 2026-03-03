import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/shared/ui/Modal';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Category } from '../../../../shared/types/categoriy';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../../api/categories.api';
import { toast } from '@/shared/ui/Toast';

const schema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
});

type FormValues = z.infer<typeof schema>;

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  categoryToEdit?: Category | null;
}

// ✅ FIX 1: onSuccess props dan destructure qilindi
export function CategoryFormModal({ isOpen, onClose, onSuccess, categoryToEdit }: CategoryFormModalProps) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue } = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { name: '' },
});

  useEffect(() => {
    if (categoryToEdit) {
      reset({ name: categoryToEdit.name });
    } else {
      reset({ name: '' });
    }
  }, [categoryToEdit, reset, isOpen]);

  const createMutation = useMutation({
  mutationFn: (data: FormValues) => categoriesApi.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    toast.success('Kategoriya yaratildi');
    onSuccess?.();
    onClose();
  },
onError: (error: any) => {
  toast.error(error.message);
},
});

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => categoriesApi.update(categoryToEdit!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Kategoriya yangilandi');
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
  toast.error(error.message || 'Xatolik yuz berdi');
},
  });

  // ✅ FIX 2: categoryToEdit bo'lsa update, bo'lmasa create
  const mutation = categoryToEdit ? updateMutation : createMutation;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={categoryToEdit ? 'Edit Category' : 'New Category'}
      size="sm"
    >
      {/* ✅ FIX 3: mutation.mutate(d) — to'g'ri chaqiruv */}
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
       <Input
  label="Category Name"
  {...register("name")}
  onChange={(e) => {
    const value = e.target.value;
    const formatted =
      value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    setValue("name", formatted);
  }}
/>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {categoryToEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}