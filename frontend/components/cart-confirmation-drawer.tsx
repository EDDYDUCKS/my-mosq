'use client';

import React from 'react';
import { useCart, CartItem } from '@/lib/cart-context';
import { Equipment } from '@/lib/types';
import { resolveEquipmentImage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { 
  X, 
  CheckCircle2, 
  ArrowRight, 
  ShoppingBag, 
  ChevronRight,
  Package
} from 'lucide-react';

interface CartConfirmationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lastAddedItem: CartItem | null;
  onGoToCart: () => void;
  allEquipment: Equipment[];
  onQuickAdd: (equipment: Equipment) => void;
}

export function CartConfirmationDrawer({
  isOpen,
  onClose,
  lastAddedItem,
  onGoToCart,
  allEquipment,
  onQuickAdd,
}: CartConfirmationDrawerProps) {
  const { cart } = useCart();

  if (!isOpen || !lastAddedItem) return null;

  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Sugerencias de productos complementarios (categoría similar o populares en stock)
  const complementary = allEquipment
    .filter(eq => eq.id !== lastAddedItem.equipment.id && eq.available > 0)
    .slice(0, 3);

  const imgSrc = resolveEquipmentImage(lastAddedItem.name);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-in panel desde la derecha */}
      <aside className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-background border-l border-border shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="p-5 border-b border-border bg-emerald-500/5 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0 stroke-[2.2]" />
                <span className="font-bold text-sm tracking-tight">Agregado a tu solicitud</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Cerrar panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Cuerpo principal con scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* Tarjeta del producto recién añadido */}
            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-card border border-border shadow-xs">
              <div className="relative w-16 h-16 rounded-xl bg-muted/40 shrink-0 overflow-hidden border border-border/50">
                <img
                  src={imgSrc}
                  alt={lastAddedItem.name}
                  className="w-full h-full object-contain p-1.5"
                />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  {lastAddedItem.category}
                </span>
                <p className="font-bold text-sm text-foreground truncate">
                  {lastAddedItem.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cantidad: <span className="font-semibold text-foreground">{lastAddedItem.quantity} ud.</span>
                </p>
              </div>
            </div>

            {/* Resumen del carrito actual */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1b4931]/10 text-[#1b4931] dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total en carrito</p>
                  <p className="text-sm font-bold text-foreground">
                    {totalUnits} {totalUnits === 1 ? 'artículo' : 'artículos'} ({cart.length} {cart.length === 1 ? 'tipo' : 'tipos'})
                  </p>
                </div>
              </div>
            </div>

            {/* Acciones principales tipo Amazon */}
            <div className="space-y-2.5 pt-1">
              <Button
                onClick={() => {
                  onClose();
                  onGoToCart();
                }}
                className="w-full h-11 bg-[#1b4931] hover:bg-[#163c28] text-white font-bold rounded-xl shadow-sm gap-2 transition-all"
              >
                <span>Tramitar Solicitud</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                onClick={onClose}
                className="w-full h-10 border-border text-foreground hover:bg-muted font-medium rounded-xl text-sm"
              >
                Seguir explorando el catálogo
              </Button>
            </div>

            {/* Sugerencias complementarias (Venta cruzada / Cross-borrow) */}
            {complementary.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Otros equipos disponibles
                  </p>
                </div>

                <div className="space-y-2">
                  {complementary.map((comp) => (
                    <div
                      key={comp.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border/60 hover:border-border bg-card transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-muted/40 shrink-0 overflow-hidden flex items-center justify-center border border-border/40">
                          <img
                            src={resolveEquipmentImage(comp.name)}
                            alt={comp.name}
                            className="w-8 h-8 object-contain"
                          />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-foreground truncate">{comp.name}</p>
                          <p className="text-[10px] text-muted-foreground">{comp.available} disp.</p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onQuickAdd(comp)}
                        className="h-7 px-2.5 text-xs font-semibold rounded-lg shrink-0 gap-1 text-[#1b4931] dark:text-emerald-300 bg-[#1b4931]/10 hover:bg-[#1b4931]/20"
                      >
                        <span>+ Agregar</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer discreto */}
          <div className="p-4 border-t border-border bg-muted/20 text-center">
            <p className="text-[11px] text-muted-foreground">
              Bienestar Estudiantil · ULSA Nicaragua
            </p>
          </div>

        </div>
      </aside>
    </div>
  );
}
