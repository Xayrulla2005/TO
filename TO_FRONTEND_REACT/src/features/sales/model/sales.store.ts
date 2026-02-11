import { create } from 'zustand';
import { Product } from '../../../shared/types/product';

export interface CartItem extends Product {
  qty: number;
}

interface SalesState {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  cart: [],
  addToCart: (product) => {
    const cart = get().cart;
    const exists = cart.find((i) => i.id === product.id);
    if (exists) {
      set({
        cart: cart.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i)),
      });
    } else {
      set({ cart: [...cart, { ...product, qty: 1 }] });
    }
  },
  removeFromCart: (id) => set({ cart: get().cart.filter((i) => i.id !== id) }),
  updateQty: (id, qty) => {
    if (qty <= 0) {
      get().removeFromCart(id);
    } else {
      set({ cart: get().cart.map((i) => (i.id === id ? { ...i, qty } : i)) });
    }
  },
  clearCart: () => set({ cart: [] }),
  cartTotal: () => get().cart.reduce((sum, item) => sum + item.salePrice * item.qty, 0),
}));