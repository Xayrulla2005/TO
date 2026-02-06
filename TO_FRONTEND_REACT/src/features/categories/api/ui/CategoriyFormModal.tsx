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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categoryToEdit?: Category | null;
}

export function CategoryFormModal({ isOpen, onClose, categoryToEdit }: Props) {
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
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

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (categoryToEdit) {
        return categoriesApi.update(categoryToEdit.id, data);
      }
      return categoriesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(categoryToEdit ? 'Category updated' : 'Category created');
      onClose();
    },
    onError: () => {
      toast.error('Failed to save category');
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={categoryToEdit ? 'Edit Category' : 'New Category'}
      size="sm"
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Input
          label="Category Name"
          placeholder="e.g. Electronics"
          {...register('name')}
          error={errors.name?.message}
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