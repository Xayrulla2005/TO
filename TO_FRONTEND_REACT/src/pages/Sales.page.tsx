import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../features/products/api/product.api';
import { salesApi } from '../features/sales/api/sales.api';
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: productsApi.getAll,
  });

  const createSaleMutation = useMutation({
    mutationFn: async (paymentData: PaymentData) => {
      // 1-bosqich: DRAFT yaratish
      const draftSale = await salesApi.create({
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: Number(item.qty),
          customUnitPrice: Number(item.unitPrice),
          discountAmount: 0,
        })),
        notes: '',
      });

      // 2-bosqich: To'lovni qabul qilish
      const payments: any[] = [];
      
      if (paymentData.cashAmount > 0) {
        payments.push({
          method: 'CASH',
          amount: paymentData.cashAmount,
        });
      }
      
      if (paymentData.cardAmount > 0) {
        payments.push({
          method: 'CARD',
          amount: paymentData.cardAmount,
        });
      }
      
      if (paymentData.debtAmount > 0) {
        payments.push({
          method: 'DEBT',
          amount: paymentData.debtAmount,
        });
      }

      const completedSale = await salesApi.complete(draftSale.id, {
        payments,
        debtorName: paymentData.customerName,
        debtorPhone: paymentData.customerPhone,
      });

      return completedSale;
    },
    onSuccess: () => {
      toast.success('Savdo muvaffaqiyatli yakunlandi!');
      setCart([]);
      setIsPaymentModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || 'Savdoni yakunlashda xatolik';
      toast.error(errorMessage);
    },
  });

  // Add product to cart
  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      
      return [...prevCart, { product, qty: 1, unitPrice: Number(product.salePrice) || 0 }];
    });
  };

  // Update quantity
  const updateQty = (productId: string, delta: number) => {
    setCart(prevCart => 
      prevCart.map(item => {
        if (item.product.id === productId) {
          const newQty = item.qty + delta;
          return newQty >= 1 ? { ...item, qty: newQty } : item;
        }
        return item;
      }).filter(item => item.qty >= 1)
    );
  };

  // Update unit price
  const updateUnitPrice = (productId: string, newPrice: number) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId
          ? { ...item, unitPrice: Number(newPrice) || 0 }
          : item
      )
    );
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
  const tax = 0;
  const grandTotal = subtotal + tax;
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  // Filter products
  const filteredProducts = (products || []).filter((p: { name: string; category: { name: string; }; }) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Static categories
  const categories = ['All', 'Electronics', 'Food', 'Drinks', 'Home'];
  const ALL_CATEGORY_KEY = "ALL";

  const handlePayment = (paymentData: PaymentData) => {
    createSaleMutation.mutate(paymentData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">
        {/* Chap: Mahsulotlar grid */}
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

            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => {
                const isAll = cat === ALL_CATEGORY_KEY;
                const label = isAll ? "Barchasi" : cat;
                const isActive = (isAll && !selectedCategory) || cat === selectedCategory;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(isAll ? null : cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-indigo-600 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
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
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={32} className="text-gray-400 opacity-20" />
                      )}
                    </div>

                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {product.name}
                      </h3>
                      <p className="text-indigo-600 font-bold mt-1">
                        {formatCurrency(product.salePrice)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Qoldiq: {product.stockQuantity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* O'ng: Savat paneli */}
        <Card className="w-full lg:w-[420px] flex flex-col border-indigo-100 shadow-lg h-[60vh] lg:h-auto">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ShoppingCart size={20} /> Joriy savdo
            </h2>
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-sm font-bold">
              {totalItems} ta
            </span>
          </div>

          {/* Savat itemlari */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                <ShoppingCart size={48} className="opacity-20" />
                <p>Savat bosh</p>
                <p className="text-xs">Qo'shish uchun mahsulotni bosing</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm space-y-2"
                >
                  <div className="flex gap-3 items-start">
                    <div className="h-12 w-12 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
                      {item.product.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={20} className="text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Bazaviy narx: {formatCurrency(item.product.salePrice)}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromCart(item.product.id);
                      }}
                      className="text-red-400 hover:text-red-600 p-1 flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.product.id, -1)}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-bold w-6 text-center text-sm">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.product.id, 1)}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">@</span>
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateUnitPrice(item.product.id, Number(e.target.value) || 0)
                        }
                        className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-indigo-500 text-right"
                        min={0}
                      />
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">
                        {formatCurrency(item.qty * item.unitPrice)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Yakuniy hisob va to'lov */}
          <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Oraliq jami</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Soliq (0%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Jami</span>
                <span>{formatCurrency(grandTotal)}</span>
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

      {/* To'lov modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={grandTotal}
        onConfirm={handlePayment}
        isSubmitting={createSaleMutation.isPending}
      />
    </>
  );
}