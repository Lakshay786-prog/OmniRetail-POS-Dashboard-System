import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/api";

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  qty: number;
}

interface CartState {
  items: CartItem[];
  discountPct: number;
  taxPct: number;
  add: (p: Product) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  setDiscount: (n: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      discountPct: 0,
      taxPct: 8,
      add: (p) =>
        set((s) => {
          const found = s.items.find((i) => i.productId === p.id);
          if (found) return { items: s.items.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i)) };
          return { items: [...s.items, { productId: p.id, name: p.name, sku: p.sku, price: p.price, qty: 1 }] };
        }),
      inc: (id) => set((s) => ({ items: s.items.map((i) => (i.productId === id ? { ...i, qty: i.qty + 1 } : i)) })),
      dec: (id) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.productId === id ? { ...i, qty: i.qty - 1 } : i))
            .filter((i) => i.qty > 0),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.productId !== id) })),
      setDiscount: (n) => set({ discountPct: Math.max(0, Math.min(100, n)) }),
      clear: () => set({ items: [], discountPct: 0 }),
    }),
    { name: "pos-cart" }
  )
);

export const cartTotals = (items: CartItem[], discountPct: number, taxPct: number) => {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = (subtotal * discountPct) / 100;
  const taxed = subtotal - discount;
  const tax = (taxed * taxPct) / 100;
  const total = taxed + tax;
  return { subtotal, discount, tax, total };
};