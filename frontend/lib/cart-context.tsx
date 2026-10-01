"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Equipment } from "./types";

export type CartItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  dueDate?: string;
  notes?: string;
  equipment: Equipment;
  [key: string]: any;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  updateCartItem: (id: string, updates: Partial<CartItem>) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "mosq_active_cart";

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {
        // Fallback a arreglo vacío
      }
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignorar errores de almacenamiento
    }
  }, [cart]);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        const maxAvailable = item.equipment?.available ?? 99;
        const newQty = Math.min(existing.quantity + item.quantity, maxAvailable);
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i));
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...updates };
        if (typeof next.quantity === "number") {
          const maxAvailable = item.equipment?.available ?? 99;
          next.quantity = Math.max(1, Math.min(next.quantity, maxAvailable));
        }
        return next;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, updateCartItem }}>
      {children}
    </CartContext.Provider>
  );
};