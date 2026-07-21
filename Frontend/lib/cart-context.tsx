"use client";
import React, { createContext, useContext, useState } from "react";
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

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      // Evitar duplicados por id
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, updateCartItem }}>
      {children}
    </CartContext.Provider>
  );
};