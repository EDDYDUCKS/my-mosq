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
import { CheckCircle2 } from 'lucide-react';

interface BorrowDialogProps {
  equipment: Equipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BorrowDialog({ equipment, open, onOpenChange }: BorrowDialogProps) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState('1');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!equipment) return;

    addToCart({
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      quantity: parseInt(quantity),
      equipment,
    });

    setSubmitted(true);

    setTimeout(() => {
      setQuantity('1');
      setSubmitted(false);
      onOpenChange(false);
    }, 1500);
  };

  if (!equipment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
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
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={equipment.available}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="border-input"
                required
              />
              <p className="text-xs text-muted-foreground">
                Disponible: {equipment.available} unidades
              </p>
            </div>

            <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
              💡 La fecha de devolución y notas se configuran al momento de enviar la solicitud desde el carrito.
            </p>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
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
