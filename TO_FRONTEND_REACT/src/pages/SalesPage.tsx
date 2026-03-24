import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { productsApi } from "../features/products/api/product.api";
import { salesApi, CompletedSale } from "../features/sales/api/sales.api";
import { categoriesApi } from "../features/categories/api/categories.api";
import { Input } from "../shared/ui/Input";
import { Button } from "../shared/ui/Button";
import { Card } from "../shared/ui/Card";
import { toast } from "../shared/ui/Toast";
import {
  Search,
  ShoppingCart,
  Trash2,
  Package,
  X,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { Product } from "../shared/types/product";
import { PaymentModal, PaymentData } from "../features/sales/PaymentModal";

interface CartItem {
  product: Product;
  qty: number;
  unitPrice: number;
}

function fmt(val: number | string | null | undefined): string {
  const n = Number(val);
  if (isNaN(n)) return "$0";
  const formatted =
    n % 1 === 0
      ? n.toLocaleString("uz-UZ")
      : parseFloat(n.toFixed(4)).toLocaleString("uz-UZ", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 4,
        });
  return "$" + formatted;
}

function fmtQty(val: number | string | null | undefined): string {
  const n = parseFloat(String(val || 0));
  if (isNaN(n)) return "0";
  return String(parseFloat(n.toFixed(4)));
}

function sortProducts(list: Product[]): Product[] {
  return [...list].sort((a, b) => {
    const aNum = /^\d/.test(a.name);
    const bNum = /^\d/.test(b.name);
    if (aNum && bNum) {
      const diff = parseFloat(a.name) - parseFloat(b.name);
      return diff !== 0 ? diff : a.name.localeCompare(b.name, "uz");
    }
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    return a.name.localeCompare(b.name, "uz");
  });
}

// Safe float operation: round to 10 decimal places to avoid JS float drift
function safeAdd(a: number, b: number): number {
  return parseFloat((a + b).toFixed(10));
}


function safeMultiply(a: number, b: number): number {
  return parseFloat((a * b).toFixed(10));
}

export function SalesPage() {
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(
    null,
  );
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [agreedPrice, setAgreedPrice] = useState<number | string | null>(null);

  // Keep a ref to the current receiptUrl so we can revoke it even if state has moved on
  const receiptUrlRef = useRef<string | null>(null);

  useEffect(() => {
    receiptUrlRef.current = receiptUrl;
  }, [receiptUrl]);

  // Revoke object URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (receiptUrlRef.current) {
        URL.revokeObjectURL(receiptUrlRef.current);
      }
    };
  }, []);

  const closeReceipt = () => {
    if (receiptUrl) {
      // Small delay so iframe/download has time to finish
      setTimeout(() => {
        URL.revokeObjectURL(receiptUrl);
      }, 150);
    }
    setReceiptUrl(null);
  };

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.getAll,
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });

  // Derive subtotal/grandTotal at render time so mutationFn closure always reads fresh values
  const subtotal = cart.reduce(
    (sum, i) => safeAdd(sum, safeMultiply(i.qty, i.unitPrice)),
    0,
  );
  const originalSubtotal = cart.reduce(
    (sum, i) =>
      safeAdd(sum, safeMultiply(i.qty, Number(i.product.salePrice) || 0)),
    0,
  );

  const grandTotal = (() => {
    if (agreedPrice === null || agreedPrice === "") return subtotal;
    const s = String(agreedPrice);
    if (s.endsWith(".")) return subtotal;
    const n = Number(s);
    if (isNaN(n) || n < 0) return subtotal;
    return parseFloat(n.toFixed(10));
  })();

  const totalItems = cart.reduce((sum, i) => safeAdd(sum, i.qty), 0);

  const discountPercent =
    originalSubtotal > 0
      ? parseFloat(
          (((originalSubtotal - grandTotal) / originalSubtotal) * 100).toFixed(
            2,
          ),
        )
      : 0;

  const createSaleMutation = useMutation({
    mutationFn: async (paymentData: PaymentData) => {
      const draftSale = await salesApi.create({
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: Number(item.qty),
          customUnitPrice: Number(item.unitPrice),
          discountAmount: 0,
        })),
        notes: "",
      });

      const payments: { method: "CASH" | "CARD" | "DEBT"; amount: number }[] =
        [];
      if (paymentData.cashAmount > 0)
        payments.push({ method: "CASH", amount: paymentData.cashAmount });
      if (paymentData.cardAmount > 0)
        payments.push({ method: "CARD", amount: paymentData.cardAmount });
      if (paymentData.debtAmount > 0)
        payments.push({ method: "DEBT", amount: paymentData.debtAmount });

      const agreedTotalValue =
        Math.abs(grandTotal - subtotal) > 0.001 ? grandTotal : undefined;

      return salesApi.complete(draftSale.id, {
        payments,
        customerId: paymentData.customerId || undefined,
        customerName: paymentData.customerName || undefined,
        customerPhone: paymentData.customerPhone || undefined,
        agreedTotal: agreedTotalValue,
      });
    },
    onSuccess: async (sale) => {
      toast.success("Savdo yakunlandi");
      try {
        const blob = await salesApi.downloadReceipt(sale.id);
        const url = window.URL.createObjectURL(
          new Blob([blob], { type: "application/pdf" }),
        );
        setReceiptUrl(url);
        setCompletedSale(sale);
      } catch {
        toast.error("Chekni yuklashda xatolik");
      }
      setCart([]);
      setAgreedPrice(null);
      setIsPaymentModalOpen(false);
      setIsCartOpen(false);
    },
    onError: () => {
      toast.error("Savdoni yakunlashda xatolik yuz berdi");
    },
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, qty: parseFloat((i.qty + 1).toFixed(10)) }
            : i,
        );
      }
      return [
        { product, qty: 1, unitPrice: Number(product.salePrice) || 0 },
        ...prev,
      ];
    });
    setAgreedPrice(null);
  };

  const updateQty = (productId: string, qty: number) => {
    const safeQty = Math.max(0.001, isNaN(qty) ? 0.001 : qty);
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, qty: safeQty } : i,
      ),
    );
    setAgreedPrice(null);
  };

  const updatePrice = (productId: string, price: number) => {
    const safePrice = Math.max(0, isNaN(price) ? 0 : price);
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, unitPrice: safePrice } : i,
      ),
    );
    setAgreedPrice(null);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
    setAgreedPrice(null);
  };

  const filteredProducts = sortProducts(
    (products || []).filter((p: Product) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        !selectedCategoryId || p.categoryId === selectedCategoryId;
      return matchesSearch && matchesCategory;
    }),
  );

  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 h-[100dvh] pb-20 lg:pb-0">
        {/* ── LEFT: Mahsulotlar ── */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3 sticky top-0 z-10">
            <Input
              placeholder="Mahsulotni nomi yoki barkod bo'yicha qidiring..."
              icon={<Search size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="h-10 text-sm"
            />
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  !selectedCategoryId
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
                }`}
              >
                Barchasi
              </button>
              {(categories || []).map((cat: { id: string; name: string }) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                    selectedCategoryId === cat.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Package size={40} className="opacity-20 mb-2" />
                <p className="text-sm">Mahsulot topilmadi</p>
              </div>
            ) : (
              filteredProducts.map((product: Product) => {
                const stock = parseFloat(String(product.stockQuantity || 0));
                const inCart = cart.find((i) => i.product.id === product.id);
                const isOut = stock <= 0;
                const isLow = stock > 0 && stock <= 5;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOut && addToCart(product)}
                    className={`flex items-center gap-3 bg-white rounded-xl border px-3 py-2.5 transition-all ${
                      isOut
                        ? "opacity-50 cursor-not-allowed border-gray-100"
                        : inCart
                          ? "border-indigo-400 shadow-sm cursor-pointer bg-indigo-50/30"
                          : "border-gray-100 hover:border-indigo-300 hover:shadow-sm cursor-pointer"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={18} className="text-gray-300" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
                        {product.name}
                      </p>
                      <p
                        className={`text-xs mt-0.5 font-medium flex items-center gap-1 ${
                          isOut
                            ? "text-red-500"
                            : isLow
                              ? "text-orange-500"
                              : "text-gray-400"
                        }`}
                      >
                        {(isOut || isLow) && (
                          <AlertTriangle size={11} className="flex-shrink-0" />
                        )}
                        {isOut
                          ? "Tugagan"
                          : isLow
                            ? `${fmtQty(stock)} ta qoldi`
                            : `${fmtQty(stock)} ta`}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-indigo-600 text-sm">
                        {fmt(product.salePrice)}
                      </p>
                      {inCart && (
                        <span className="inline-block mt-0.5 bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                          {fmtQty(inCart.qty)} ta
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: Savat (Desktop) ── */}
        <div className="hidden lg:flex w-[400px] flex-col">
          <Card className="flex flex-col h-full border-indigo-100 shadow-lg">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-base flex items-center gap-2 text-gray-800">
                <ShoppingCart size={18} className="text-indigo-600" /> Joriy
                savdo
              </h2>
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
                {fmtQty(totalItems)} ta
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                  <ShoppingCart size={40} className="opacity-20" />
                  <p className="text-sm">Savat bosh</p>
                  <p className="text-xs text-gray-400">Mahsulotni bosing</p>
                </div>
              ) : (
                cart.map((item) => (
                  <CartItemRow
                    key={item.product.id}
                    item={item}
                    onUpdateQty={updateQty}
                    onUpdatePrice={updatePrice}
                    onRemove={removeFromCart}
                  />
                ))
              )}
            </div>

            <CartFooter
              subtotal={subtotal}
              originalSubtotal={originalSubtotal}
              cart={cart}
              onPay={() => setIsPaymentModalOpen(true)}
              agreedPrice={agreedPrice}
              onAgreedPriceChange={setAgreedPrice}
              discountPercent={discountPercent}
            />
          </Card>
        </div>

        {/* ── MOBILE: Floating Cart ── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-white border-t border-gray-200 shadow-xl">
          {isCartOpen ? (
            <div
              className="fixed inset-0 z-40 bg-black/40 flex flex-col justify-end"
              onClick={() => setIsCartOpen(false)}
            >
              <div
                className="bg-white rounded-t-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h2 className="font-bold text-base flex items-center gap-2">
                    <ShoppingCart size={18} className="text-indigo-600" /> Joriy
                    savdo
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
                      {fmtQty(totalItems)} ta
                    </span>
                  </h2>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-1 rounded-lg hover:bg-gray-100"
                  >
                    <ChevronUp size={20} className="text-gray-500" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {cart.length === 0 ? (
                    <div className="py-8 flex flex-col items-center text-gray-400">
                      <ShoppingCart size={36} className="opacity-20 mb-2" />
                      <p className="text-sm">Savat bosh</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <CartItemRow
                        key={item.product.id}
                        item={item}
                        onUpdateQty={updateQty}
                        onUpdatePrice={updatePrice}
                        onRemove={removeFromCart}
                      />
                    ))
                  )}
                </div>
                <CartFooter
                  subtotal={subtotal}
                  originalSubtotal={originalSubtotal}
                  cart={cart}
                  onPay={() => {
                    setIsCartOpen(false);
                    setIsPaymentModalOpen(true);
                  }}
                  agreedPrice={agreedPrice}
                  onAgreedPriceChange={setAgreedPrice}
                  discountPercent={discountPercent}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full flex items-center justify-between bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-lg"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} />
                <span className="font-semibold text-sm">Savat</span>
                {totalItems > 0 && (
                  <span className="bg-white text-indigo-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {fmtQty(totalItems)} ta
                  </span>
                )}
              </div>
              <span className="font-bold text-sm">{fmt(grandTotal)}</span>
            </button>
          )}
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={grandTotal}
        onConfirm={(pd) => createSaleMutation.mutate(pd)}
        isSubmitting={createSaleMutation.isPending}
      />

      {receiptUrl && completedSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: "90vh" }}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Chek</h3>
              <button
                onClick={closeReceipt}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div
              className="flex-1 overflow-hidden"
              style={{ minHeight: "400px" }}
            >
              <iframe
                src={receiptUrl}
                className="w-full h-full"
                style={{ minHeight: "400px" }}
                title="receipt"
              />
            </div>
            <div className="p-3 border-t flex gap-2">
              <button
                onClick={() => {
                  const iframe = document.querySelector(
                    "iframe",
                  ) as HTMLIFrameElement;
                  iframe?.contentWindow?.print();
                }}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm"
              >
                Print
              </button>

              <a
                href={receiptUrl}
                download={`receipt-${completedSale.saleNumber}.pdf`}
                className="flex-1 bg-gray-100 text-gray-700 text-center py-2.5 rounded-xl font-semibold text-sm"
              >
                PDF yuklash
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── CartItemRow ──────────────────────────────────────────────
function CartItemRow({
  item,
  onUpdateQty,
  onUpdatePrice,
  onRemove,
}: {
  item: CartItem;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onRemove: (id: string) => void;
}) {
  const [qtyInput, setQtyInput] = useState(String(item.qty));
  const [priceInput, setPriceInput] = useState(String(item.unitPrice));

  // Sync local input display when parent cart item changes (e.g. re-added from product list)
  useEffect(() => {
    setQtyInput(String(item.qty));
  }, [item.qty]);

  useEffect(() => {
    setPriceInput(String(item.unitPrice));
  }, [item.unitPrice]);

  const originalPrice = Number(item.product.salePrice) || 0;
  const currentPrice = Number(item.unitPrice);
  const itemDiscountPercent =
    originalPrice > 0 && currentPrice < originalPrice
      ? parseFloat(((1 - currentPrice / originalPrice) * 100).toFixed(1))
      : 0;

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
          {item.product.imageUrl ? (
            <img
              src={item.product.imageUrl}
              alt={item.product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={16} className="text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-xs leading-tight line-clamp-2">
            {item.product.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-xs text-gray-400">
              Asl narx: {fmt(originalPrice)}
            </p>
            {itemDiscountPercent > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                -{itemDiscountPercent}%
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onRemove(item.product.id)}
          className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Soni */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Soni:</span>
          <input
            type="number"
            step="any"
            value={qtyInput}
            onChange={(e) => {
              const raw = e.target.value;
              setQtyInput(raw);
              const val = parseFloat(raw);
              if (!isNaN(val) && val > 0) onUpdateQty(item.product.id, val);
            }}
            onBlur={() => {
              const val = parseFloat(qtyInput);
              if (isNaN(val) || val <= 0) {
                setQtyInput("1");
                onUpdateQty(item.product.id, 1);
              } else {
                setQtyInput(String(val));
              }
            }}
            className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 text-center bg-white font-bold"
            min={0.001}
          />
        </div>

        <span className="text-gray-300 text-xs">×</span>

        {/* Narx */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Narx:</span>
          <div className="relative">
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-orange-400 font-bold pointer-events-none">
              $
            </span>
            <input
              type="number"
              step="any"
              value={priceInput}
              onChange={(e) => {
                const raw = e.target.value;
                setPriceInput(raw);
                const val = parseFloat(raw);
                if (!isNaN(val) && val >= 0)
                  onUpdatePrice(item.product.id, val);
              }}
              onBlur={() => {
                const val = parseFloat(priceInput);
                if (isNaN(val) || val < 0) {
                  setPriceInput(String(originalPrice));
                  onUpdatePrice(item.product.id, originalPrice);
                } else {
                  setPriceInput(String(val));
                }
              }}
              className={`w-20 pl-5 pr-1 py-1 text-xs border rounded-lg focus:outline-none text-center font-bold transition-colors ${
                itemDiscountPercent > 0
                  ? "border-orange-300 bg-orange-50 text-orange-700 focus:border-orange-500"
                  : "border-gray-200 bg-white text-gray-700 focus:border-indigo-400"
              }`}
              min={0}
            />
          </div>
        </div>

        <p className="font-bold text-indigo-600 text-sm flex-shrink-0 ml-auto">
          {fmt(item.qty * item.unitPrice)}
        </p>
      </div>
    </div>
  );
}

// ── CartFooter ──────────────────────────────────────────────
function CartFooter({
  subtotal,
  originalSubtotal,
  cart,
  onPay,
  agreedPrice,
  onAgreedPriceChange,
}: {
  subtotal: number;
  originalSubtotal: number;
  cart: CartItem[];
  onPay: () => void;
  agreedPrice: number | string | null;
  onAgreedPriceChange: (val: number | string | null) => void;
  discountPercent: number;
}) {
  const displayTotal = (() => {
    if (agreedPrice === null || agreedPrice === "") return subtotal;
    const s = String(agreedPrice);
    if (s.endsWith(".")) return subtotal;
    const n = Number(s);
    if (isNaN(n) || n < 0) return subtotal;
    return n;
  })();

  const agreedDiscountPercent =
    originalSubtotal > 0 && displayTotal < originalSubtotal
      ? parseFloat(((1 - displayTotal / originalSubtotal) * 100).toFixed(2))
      : 0;

  // Use a key that forces input remount when subtotal changes while agreedPrice is null
  // This prevents stale displayed value when cart items change
  const inputKey = agreedPrice === null ? `sub-${subtotal}` : "agreed";

  return (
    <div className="p-3 border-t border-gray-100 bg-white space-y-2">
      {originalSubtotal !== subtotal && (
        <div className="flex justify-between text-xs text-gray-400">
          <span>Asl narx jami</span>
          <span className="line-through">{fmt(originalSubtotal)}</span>
        </div>
      )}

      {subtotal < originalSubtotal && (
        <div className="flex justify-between text-xs text-green-600">
          <span>Narx chegirmasi</span>
          <span>
            -{fmt(originalSubtotal - subtotal)} (
            {parseFloat(((1 - subtotal / originalSubtotal) * 100).toFixed(2))}%)
          </span>
        </div>
      )}

      <div className="flex justify-between text-xs text-gray-500">
        <span>Oraliq jami</span>
        <span>{fmt(subtotal)}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 whitespace-nowrap">
          Kelishilgan narx
        </span>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-bold pointer-events-none">
            $
          </span>
          <input
            key={inputKey}
            type="text"
            inputMode="decimal"
            defaultValue={
              agreedPrice !== null ? String(agreedPrice) : String(subtotal)
            }
            onChange={(e) => {
              const raw = e.target.value;
              if (!/^[\d.]*$/.test(raw)) return;
              if ((raw.match(/\./g) || []).length > 1) return;
              if (raw === "") {
                onAgreedPriceChange(null);
                return;
              }
              if (raw.endsWith(".")) {
                onAgreedPriceChange(raw);
                return;
              }
              const val = Number(raw);
              if (isNaN(val) || val < 0) return;
              onAgreedPriceChange(
                Math.abs(val - subtotal) < 0.0001 ? null : val,
              );
            }}
            className="w-28 pl-6 pr-2 py-1 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-500 text-right bg-indigo-50 font-semibold text-indigo-700"
          />
        </div>
      </div>

      {agreedDiscountPercent > 0 && (
        <div className="flex justify-between text-xs text-orange-600 bg-orange-50 rounded-lg px-2 py-1">
          <span>Kelishilgan chegirma</span>
          <span className="font-bold">
            -{agreedDiscountPercent}% ({fmt(originalSubtotal - displayTotal)})
          </span>
        </div>
      )}

      <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-100">
        <span>Jami</span>
        <div className="flex items-center gap-2">
          {agreedDiscountPercent > 0 && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
              -{agreedDiscountPercent}%
            </span>
          )}
          <span className="text-indigo-600">{fmt(displayTotal)}</span>
        </div>
      </div>

      <Button
        size="lg"
        className="w-full text-sm font-bold"
        onClick={onPay}
        disabled={cart.length === 0}
      >
        To'lov qilish
      </Button>
    </div>
  );
}
