import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product } from '../../../shared/types/product';

export interface CartItem {
  product: Product;
  quantity: number;       // ✅ qty emas — backend bilan mos
  unitPrice: number;      // ✅ customUnitPrice — o'zgartirilgan narx
}

interface SalesState {
  cart: CartItem[];
  addToCart:      (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateUnitPrice:(productId: string, price: number) => void;
  clearCart:      () => void;
  cartSubtotal:   () => number;   // har bir item.unitPrice * quantity
  cartOriginal:   () => number;   // har bir item.product.salePrice * quantity
}

export const useSalesStore = create<SalesState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (product) => {
        const existing = get().cart.find((i) => i.product.id === product.id);
        if (existing) {
          set({
            cart: get().cart.map((i) =>
              i.product.id === product.id
                ? { ...i, quantity: parseFloat((i.quantity + 1).toFixed(10)) }
                : i,
            ),
          });
        } else {
          set({
            cart: [
              { product, quantity: 1, unitPrice: Number(product.salePrice) || 0 },
              ...get().cart,
            ],
          });
        }
      },

      removeFromCart: (productId) =>
        set({ cart: get().cart.filter((i) => i.product.id !== productId) }),

      updateQuantity: (productId, quantity) => {
        const safe = Math.max(0.001, isNaN(quantity) ? 0.001 : quantity);
        if (safe <= 0) {
          set({ cart: get().cart.filter((i) => i.product.id !== productId) });
        } else {
          set({
            cart: get().cart.map((i) =>
              i.product.id === productId ? { ...i, quantity: safe } : i,
            ),
          });
        }
      },

      updateUnitPrice: (productId, price) => {
        const safe = Math.max(0, isNaN(price) ? 0 : price);
        set({
          cart: get().cart.map((i) =>
            i.product.id === productId ? { ...i, unitPrice: safe } : i,
          ),
        });
      },

      clearCart: () => set({ cart: [] }),

      cartSubtotal: () =>
        get().cart.reduce(
          (sum, i) => sum + parseFloat((i.quantity * i.unitPrice).toFixed(10)),
          0,
        ),

      cartOriginal: () =>
        get().cart.reduce(
          (sum, i) =>
            sum + parseFloat((i.quantity * (Number(i.product.salePrice) || 0)).toFixed(10)),
          0,
        ),
    }),
    {
      name: 'sales-cart-v2',          // ✅ yangi key — eski buzuq kesh tozalanadi
      storage: createJSONStorage(() => localStorage),
    },
  ),
);