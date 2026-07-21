'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { createLoan } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Trash2, ShoppingCart } from 'lucide-react';

const PENDING_LOAN_KEY = 'mosq_pending_loan_id';

export const Cart: React.FC = () => {
  const { cart, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  if (cart.length === 0) {
    return (
      <Card className="border-dashed border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
        <CardContent className="pt-12 pb-12 text-center">
          <ShoppingCart className="w-16 h-16 text-green-300 mx-auto mb-4" />
          <p className="text-foreground font-semibold mb-2">El carrito está vacío</p>
          <p className="text-sm text-muted-foreground">Agrega equipos desde el catálogo para crear una solicitud</p>
        </CardContent>
      </Card>
    );
  }

  const minDate = new Date();
  const minDateStr = minDate.toISOString().split('T')[0];
  
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 2);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Necesitas iniciar sesión para enviar la solicitud.');
      return;
    }

    if (!dueDate) {
      setError('Debes seleccionar una fecha de devolución.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { id } = await createLoan({
        estudiante: Number(user.id),
        fecha_devolucion: dueDate,
        observaciones: notes || undefined,
        detalles: cart.map((item) => ({
          equipo: Number(item.equipment.id),
          cantidad: item.quantity,
        })),
      });

      if (!id) {
        throw new Error('El servidor no retornó el ID del préstamo. Contacta al administrador.');
      }

      localStorage.setItem(PENDING_LOAN_KEY, String(id));
      clearCart();
      router.push(`/espera/${id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo enviar la solicitud.');
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Carrito de Préstamo
        </CardTitle>
        <CardDescription>
          {cart.length} {cart.length === 1 ? 'equipo' : 'equipos'} en el carrito
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Items List */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Equipos seleccionados</p>
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 bg-muted rounded-lg border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                  <span className="text-xs text-muted-foreground">
                    Cantidad: {item.quantity}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFromCart(item.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Checkout Fields */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Detalles de la solicitud</p>

            <div className="space-y-2">
              <Label htmlFor="checkout-due-date">Fecha de Devolución *</Label>
              <Input
                id="checkout-due-date"
                type="date"
                min={minDateStr}
                max={maxDateStr}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-input"
                required
              />
              <p className="text-xs text-muted-foreground">
                Máximo 2 días a partir de hoy
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkout-notes">Notas (Opcional)</Label>
              <Textarea
                id="checkout-notes"
                placeholder="¿Para qué actividad necesitas los equipos?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="border-input resize-none"
                rows={2}
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Al enviar, esperarás la aprobación del encargado con tu código QR.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={clearCart}
              className="flex-1"
              disabled={isSubmitting}
            >
              Vaciar Carrito
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
