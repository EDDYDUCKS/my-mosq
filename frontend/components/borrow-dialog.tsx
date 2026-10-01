'use client';

import React, { useState } from 'react';
import { Equipment } from '@/lib/types';
import { useCart } from '@/lib/cart-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Info, Plus, Minus } from 'lucide-react';

interface BorrowDialogProps {
  equipment: (Equipment & { variants?: Equipment[] }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddedItem?: (item: any) => void;
}

export function BorrowDialog({ equipment, open, onOpenChange, onAddedItem }: BorrowDialogProps) {
  const { addToCart } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  React.useEffect(() => {
    if (open) {
      setQuantities({});
    }
  }, [open, equipment]);

  const handleAdjust = (variantId: string, current: number, delta: number, max: number) => {
    const next = Math.max(0, Math.min(current + delta, max));
    setQuantities(prev => ({ ...prev, [variantId]: next }));
  };

  const handleDirectAddOne = (variant: Equipment) => {
    const item = {
      id: String(variant.id),
      name: variant.marca_modelo ? `${variant.name} (${variant.marca_modelo})` : variant.name,
      category: variant.category,
      quantity: 1,
      equipment: variant,
    };
    addToCart(item);
    onOpenChange(false);
    if (onAddedItem) onAddedItem(item);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipment) return;

    const variantsToProcess = equipment.variants || [equipment];
    let addedSomething = false;
    let lastAdded: any = null;

    variantsToProcess.forEach(variant => {
      const q = quantities[variant.id] || 0;
      if (q > 0) {
        const item = {
          id: String(variant.id),
          name: variant.marca_modelo ? `${variant.name} (${variant.marca_modelo})` : variant.name,
          category: variant.category,
          quantity: q,
          equipment: variant,
        };
        addToCart(item);
        lastAdded = item;
        addedSomething = true;
      }
    });

    if (!addedSomething) return;

    setQuantities({});
    onOpenChange(false);
    if (onAddedItem && lastAdded) {
      onAddedItem(lastAdded);
    }
  };

  if (!equipment) return null;

  const variants = equipment.variants || [equipment];
  const totalSelected = Object.values(quantities).reduce((acc, q) => acc + q, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-bold">Seleccionar Modelo</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {equipment.name} · Elige el modelo o marca que prefieras
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {variants.map(variant => {
              const currentQty = quantities[variant.id] || 0;
              const hasStock = variant.available > 0;

              return (
                <div 
                  key={variant.id} 
                  className="flex items-center justify-between gap-3 p-3.5 border border-border rounded-xl bg-card hover:border-border/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {variant.marca_modelo || 'Modelo General'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {variant.color && <span>Color: {variant.color}</span>}
                      <span>·</span>
                      <span className={hasStock ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500'}>
                        {hasStock ? `${variant.available} disponibles` : 'Sin stock'}
                      </span>
                    </div>
                  </div>

                  {hasStock ? (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Botón rápido "+1 directo" si no ha seleccionado aún */}
                      {currentQty === 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleDirectAddOne(variant)}
                          className="h-8 px-3 text-xs bg-[#1b4931]/10 hover:bg-[#1b4931]/20 text-[#1b4931] dark:text-emerald-300 font-bold rounded-lg border border-[#1b4931]/20"
                        >
                          + Agregar 1
                        </Button>
                      ) : (
                        /* Selector táctil sin teclado */
                        <div className="flex items-center rounded-xl border border-border bg-muted/30 p-1">
                          <button
                            type="button"
                            onClick={() => handleAdjust(String(variant.id), currentQty, -1, variant.available)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-foreground">
                            {currentQty}
                          </span>
                          <button
                            type="button"
                            disabled={currentQty >= variant.available}
                            onClick={() => handleAdjust(String(variant.id), currentQty, 1, variant.available)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Agotado</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 border border-border/60">
            <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>La fecha de devolución se confirma directamente en el carrito de compras.</span>
          </div>

          {totalSelected > 0 && (
            <DialogFooter className="pt-2">
              <Button
                type="submit"
                className="w-full bg-[#1b4931] hover:bg-[#163c28] text-white font-bold h-10 rounded-xl"
              >
                Agregar selección ({totalSelected} {totalSelected === 1 ? 'artículo' : 'artículos'})
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
