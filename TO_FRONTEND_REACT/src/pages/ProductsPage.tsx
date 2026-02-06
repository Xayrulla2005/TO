import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../features/products/api/product.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/Table';
import { ProductFormModal } from '../features/products/api/ui/ProductFormModal';
import { Modal } from '@/shared/ui/Modal';
import { Input } from '@/shared/ui/Input';
import { Badge } from '@/shared/ui/Badge';
import { toast } from '@/shared/ui/Toast';
import { LoadingSpinner } from '@/shared/ui/Loading';
import { Plus, Edit, Trash2, Search, Package, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/shared/lib/utils';
import { Product } from '@/shared/types/product';

export function ProductsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: productsApi.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: productsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
      setDeletingId(null);
    },
    onError: () => toast.error('Failed to delete product'),
  });

  const handleEdit = (prod: Product) => {
    setEditingProduct(prod);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category?.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <LoadingSpinner className="h-96" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products Inventory</h1>
          <p className="text-gray-500">Manage {products?.length || 0} items</p>
        </div>
        {isAdmin && (
          <Button leftIcon={<Plus size={18} />} onClick={handleCreate}>
            Add Product
          </Button>
        )}
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="w-full sm:max-w-xs">
            <Input 
              placeholder="Search products..." 
              icon={<Search size={18} />} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Purch. Price</TableHead>
              <TableHead>Sale Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts?.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={20} className="text-gray-400" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-700">
                    {product.category?.name || 'Uncategorized'}
                  </span>
                </TableCell>
                <TableCell>{formatCurrency(product.purchasePrice)}</TableCell>
                <TableCell className="font-medium text-indigo-600">
                  {formatCurrency(product.salePrice)}
                </TableCell>
                <TableCell>
                  <span className={product.stockQty <= 5 ? "text-red-600 font-bold" : "text-gray-700"}>
                    {product.stockQty}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={product.stockQty > 0 ? 'success' : 'danger'}>
                    {product.stockQty > 0 ? 'In Stock' : 'Out of Stock'}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(product)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => setDeletingId(product.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredProducts?.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-500">
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        productToEdit={editingProduct}
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
            <p className="text-sm font-medium">Permanently delete product?</p>
          </div>
          <p className="text-gray-600">
            This action cannot be undone. Sales history for this product might be preserved for audit logs.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button 
              variant="danger" 
              isLoading={deleteMutation.isPending} 
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              Delete Product
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}