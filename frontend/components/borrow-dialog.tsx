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
import { CheckCircle2, Info } from 'lucide-react';

interface BorrowDialogProps {
  equipment: (Equipment & { variants?: Equipment[] }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddedItem?: (item: any) => void;
}

export function BorrowDialog({ equipment, open, onOpenChange, onAddedItem }: BorrowDialogProps) {
  const { addToCart } = useCart();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!equipment) return;

    const variantsToProcess = equipment.variants || [equipment];
    let addedSomething = false;
    let lastAdded: any = null;

    variantsToProcess.forEach(variant => {
      const q = parseInt(quantities[variant.id] || '0');
      if (q > 0) {
        const item = {
          id: variant.id,
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

    if (!addedSomething) return; // Prevent empty submits

    setQuantities({});
    onOpenChange(false);
    if (onAddedItem && lastAdded) {
      onAddedItem(lastAdded);
    }
  };

  if (!equipment) return null;

  const variants = equipment.variants || [equipment];
  const totalSelected = Object.values(quantities).reduce((acc, q) => acc + (parseInt(q) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar al Carrito</DialogTitle>
          <DialogDescription>
            {equipment.name}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <div>
              <p className="font-semibold text-foreground">¡Agregado al Carrito!</p>
              <p className="text-sm text-muted-foreground">
                Puedes seguir agregando equipos o ir al carrito para enviar tu solicitud.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
              {variants.map(variant => (
                <div key={variant.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg bg-card">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {variant.marca_modelo || 'Modelo General'}
                    </p>
                    {variant.color && (
                      <p className="text-xs text-muted-foreground">Color: {variant.color}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Disp: {variant.available}
                    </p>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="0"
                      max={variant.available}
                      value={quantities[variant.id] || ''}
                      placeholder="0"
                      onChange={(e) => setQuantities({ ...quantities, [variant.id]: e.target.value })}
                      className="border-input text-center h-9"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/60 rounded-xl p-3 border border-border">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>La fecha de devolución y notas se configuran al momento de enviar la solicitud desde el carrito.</span>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={totalSelected === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Agregar al Carrito
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
