import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../features/categories/api/categories.api';
import { useAuthStore } from '../features/auth/model/auth.store';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../shared/ui/Table';
import { CategoryFormModal } from '../features/categories/api/ui/CategoriyFormModal';
import { Modal } from '../shared/ui/Modal';
import { toast } from '../shared/ui/Toast';
import { LoadingSpinner } from '../shared/ui/Loading';
import { Plus, Edit, Trash2, FolderOpen, AlertTriangle } from 'lucide-react';
import { Category } from '../shared/types/categoriy';

export function CategoriesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: categoriesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted');
      setDeletingId(null);
    },
    onError: () => toast.error('Failed to delete category (might contain products)'),
  });

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setIsFormOpen(true);
  };

  if (isLoading) return <LoadingSpinner className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kategoriyalar</h1>
          <p className="text-gray-500">Mahsulot kategoriyalarini boshqarish</p>
        </div>
        {isAdmin && (
          <Button leftIcon={<Plus size={18} />} onClick={handleCreate}>
            Yangi kategoriya
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Icon</TableHead>
              <TableHead>Kategoriya nomi</TableHead>
              <TableHead>Mahsulot</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories?.map((cat: Category) => (
              <TableRow key={cat.id}>
                <TableCell>
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <FolderOpen size={20} />
                  </div>
                </TableCell>
                <TableCell className="font-medium text-gray-900">{cat.name}</TableCell>
                <TableCell className="text-gray-500">
                  {cat._count?.products || 0} items
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(cat)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => setDeletingId(cat.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {categories?.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-gray-500">
                  No categories found. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <CategoryFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        categoryToEdit={editingCategory}
      />

      <Modal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Confirm Deletion"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertTriangle size={24} />
            <p className="text-sm font-medium">This action cannot be undone.</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete this category? Products in this category might be affected.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button 
              variant="danger" 
              isLoading={deleteMutation.isPending} 
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              Kategoriyani ochirish
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}