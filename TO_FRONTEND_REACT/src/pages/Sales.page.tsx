import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../features/products/api/product.api';
import { salesApi } from '../features/sales/api/sales.api';
import { categoriesApi } from '../features/categories/api/categories.api'; // ✅ QO'SHILDI
import { Input } from '../shared/ui/Input';
import { Button } from '../shared/ui/Button';
import { Card } from '../shared/ui/Card';
import { toast } from '../shared/ui/Toast';
import { Search, ShoppingCart, Trash2, Package, Plus, Minus } from 'lucide-react';
import { formatCurrency } from '../shared/lib/utils';
import { Product } from '../shared/types/product';
import { PaymentModal, PaymentData } from '../features/sales/PaymentModal';

interface CartItem {
  product: Product;
  qty: number;
  unitPrice: number;
}

export function SalesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  // ✅ null = "Barchasi", string = category ID
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: productsApi.getAll,
  });

  // ✅ Kategoriyalar DB dan (hardcode emas!)
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getAll,
  });

  const createSaleMutation = useMutation({
    mutationFn: async (paymentData: PaymentData) => {
      const draftSale = await salesApi.create({
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: Number(item.qty),
          customUnitPrice: Number(item.unitPrice),
          discountAmount: 0,
        })),
        notes: '',
      });

      const payments: any[] = [];
      if (paymentData.cashAmount > 0) payments.push({ method: 'CASH', amount: paymentData.cashAmount });
      if (paymentData.cardAmount > 0) payments.push({ method: 'CARD', amount: paymentData.cardAmount });
      if (paymentData.debtAmount > 0) payments.push({ method: 'DEBT', amount: paymentData.debtAmount });

      return salesApi.complete(draftSale.id, {
        payments,
        debtorName: paymentData.customerName,
        debtorPhone: paymentData.customerPhone,
      });
    },
    onSuccess: () => {
      toast.success('Savdo muvaffaqiyatli yakunlandi!');
      setCart([]);
      setIsPaymentModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Savdoni yakunlashda xatolik');
    },
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1, unitPrice: Number(product.salePrice) || 0 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev =>
      prev.map(i => i.product.id === productId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );
  };

  const updateUnitPrice = (productId: string, newPrice: number) => {
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, unitPrice: Number(newPrice) || 0 } : i));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const grandTotal = subtotal;
  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);

  // ✅ Filter: categoryId bo'yicha (p.category?.name emas!)
  const filteredProducts = (products || []).filter((p: Product) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategoryId || p.categoryId === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 flex flex-col min-h-0 bg-gray-50 border-none shadow-none lg:bg-white lg:shadow-sm lg:border-gray-100">
          <div className="p-4 bg-white lg:rounded-t-2xl border-b border-gray-100 sticky top-0 z-10">
            <Input
              placeholder="Mahsulotni nomi yoki barkod bo'yicha qidiring..."
              icon={<Search size={18} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="text-lg h-12"
            />

            {/* ✅ Kategoriya tugmalari DB dan */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  !selectedCategoryId
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-indigo-600 hover:text-white'
                }`}
              >
                Barchasi
              </button>
              {(categories || []).map((cat: { id: string; name: string }) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedCategoryId === cat.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Package size={48} className="opacity-20 mb-2" />
                <p>Mahsulot topilmadi</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredProducts.map((product: Product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col"
                  >
                    <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={32} className="text-gray-400 opacity-20" />
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{product.name}</h3>
                      <p className="text-indigo-600 font-bold mt-1">{formatCurrency(product.salePrice)}</p>
                      {/* ✅ 5 ta va kamda ogohlantirish */}
                      <p className={`text-xs mt-1 font-medium ${
                        product.stockQuantity === 0
                          ? 'text-red-600'
                          : product.stockQuantity <= 5
                          ? 'text-orange-500'
                          : 'text-gray-500'
                      }`}>
                        {product.stockQuantity === 0
                          ? '⚠ Tugagan!'
                          : product.stockQuantity <= 5
                          ? `⚠ Kam qoldiq: ${product.stockQuantity} ta`
                          : `Qoldiq: ${product.stockQuantity}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Savat */}
        <Card className="w-full lg:w-[420px] flex flex-col border-indigo-100 shadow-lg h-[60vh] lg:h-auto">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ShoppingCart size={20} /> Joriy savdo
            </h2>
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-sm font-bold">{totalItems} ta</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                <ShoppingCart size={48} className="opacity-20" />
                <p>Savat bosh</p>
                <p className="text-xs">Qo'shish uchun mahsulotni bosing</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm space-y-2">
                  <div className="flex gap-3 items-start">
                    <div className="h-12 w-12 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={20} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">{item.product.name}</p>
                      <p className="text-xs text-gray-500">Bazaviy narx: {formatCurrency(item.product.salePrice)}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.product.id, -1)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600">
                        <Minus size={14} />
                      </button>
                      <span className="font-bold w-6 text-center text-sm">{item.qty}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600">
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">@</span>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateUnitPrice(item.product.id, Number(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-indigo-500 text-right"
                        min={0}
                      />
                    </div>
                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(item.qty * item.unitPrice)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Oraliq jami</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Soliq (0%)</span><span>{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Jami</span><span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full text-lg shadow-indigo-200 shadow-lg"
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={cart.length === 0}
            >
              To'lov qilish
            </Button>
          </div>
        </Card>
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={grandTotal}
        onConfirm={(pd) => createSaleMutation.mutate(pd)}
        isSubmitting={createSaleMutation.isPending}
      />
    </>
  );
}