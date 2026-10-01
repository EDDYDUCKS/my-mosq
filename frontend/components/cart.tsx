'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { createLoan, resolveEquipmentImage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  Trash2, 
  ShoppingCart, 
  Plus, 
  Minus, 
  ArrowRight, 
  Calendar, 
  ShieldCheck, 
  PackageCheck,
  CheckCircle2
} from 'lucide-react';

const PENDING_LOAN_KEY = 'mosq_pending_loan_id';

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const Cart: React.FC = () => {
  const { cart, removeFromCart, updateCartItem, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  if (cart.length === 0) {
    return (
      <Card className="border-dashed border-border bg-card/50 rounded-2xl p-6 sm:p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/60 text-muted-foreground mx-auto mb-4 flex items-center justify-center">
          <ShoppingCart className="w-8 h-8 stroke-[1.8]" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">Tu carrito de préstamo está vacío</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
          Explora los artículos deportivos disponibles en la bodega y agrégalos para preparar tu solicitud.
        </p>
        <Button
          onClick={() => router.push('/prestamos')}
          className="bg-[#1b4931] hover:bg-[#163c28] text-white font-semibold rounded-xl px-6"
        >
          Explorar Catálogo
        </Button>
      </Card>
    );
  }

  const minDate = new Date();
  const minDateStr = toLocalDateString(minDate);
  
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 1);
  const maxDateStr = toLocalDateString(maxDate);

  const handleQuantityChange = (id: string, current: number, delta: number, max: number) => {
    const next = current + delta;
    if (next <= 0) {
      removeFromCart(id);
    } else if (next <= max) {
      updateCartItem(id, { quantity: next });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Necesitas iniciar sesión para enviar la solicitud.');
      return;
    }

    if (user.role !== 'admin' && user.requiere_completar_perfil) {
      router.push('/completar-perfil');
      return;
    }

    if (!dueDate) {
      setError('Debes seleccionar una fecha de devolución.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fechaDevolucionISO = `${dueDate}T19:00:00`;
      const { id } = await createLoan({
        estudiante: Number(user.id),
        fecha_devolucion: fechaDevolucionISO,
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
    } catch (submitError: any) {
      const msg = submitError instanceof Error ? submitError.message : 'No se pudo enviar la solicitud.';
      if (
        msg.toLowerCase().includes('perfil') ||
        msg.toLowerCase().includes('carrera') ||
        msg.toLowerCase().includes('carnet')
      ) {
        router.push('/completar-perfil');
        return;
      }
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* ── COLUMNA IZQUIERDA: Zona de Revisión de Artículos (Estilo Amazon) ── */}
      <div className="lg:col-span-7 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h3 className="text-xl font-bold text-foreground">Equipos en tu solicitud</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cart.length} {cart.length === 1 ? 'modelo seleccionado' : 'modelos seleccionados'} ({totalItems} unidades)
            </p>
          </div>
          <button
            type="button"
            onClick={clearCart}
            className="text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"
          >
            Vaciar todo
          </button>
        </div>

        <div className="space-y-3">
          {cart.map((item) => {
            const maxAvailable = item.equipment?.available ?? 99;
            const imgSrc = resolveEquipmentImage(item.name);

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-16 h-16 rounded-xl bg-muted/40 shrink-0 overflow-hidden border border-border/40">
                    <img
                      src={imgSrc}
                      alt={item.name}
                      className="w-full h-full object-contain p-1.5"
                    />
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      {item.category}
                    </span>
                    <p className="font-bold text-sm text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Disponible en bodega ({maxAvailable} unidades)
                    </p>
                  </div>
                </div>

                {/* Controles locales: Selector de cantidad e icon quitar */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                  <div className="flex items-center rounded-xl border border-border bg-muted/30 p-1">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.id, item.quantity, -1, maxAvailable)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-foreground">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={item.quantity >= maxAvailable}
                      onClick={() => handleQuantityChange(item.id, item.quantity, 1, maxAvailable)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Eliminar del carrito"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Garantía de servicio institucional */}
        <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 flex items-start gap-3 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p>
            Los equipos se reservan en el momento de generar el ticket. Recuerda retirarlos en la bodega de deportes dentro del horario laboral.
          </p>
        </div>
      </div>

      {/* ── COLUMNA DERECHA: Zona de Conversión Fija (Sticky Summary) ── */}
      <div className="lg:col-span-5 lg:sticky lg:top-20">
        <Card className="rounded-2xl border-border shadow-md overflow-hidden bg-card">
          <CardHeader className="bg-muted/30 border-b border-border/80 pb-4">
            <CardTitle className="text-base font-bold text-foreground">Resumen de la Solicitud</CardTitle>
            <CardDescription className="text-xs">
              Completa los detalles para procesar tu entrega
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Desglose de totales */}
              <div className="space-y-2 pb-3 border-b border-border text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Equipos solicitados</span>
                  <span className="font-semibold text-foreground">{cart.length} tipos</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total de unidades</span>
                  <span className="font-semibold text-foreground">{totalItems} unidades</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Retiro en</span>
                  <span className="font-semibold text-foreground">Bodega de Deportes ULSA</span>
                </div>
              </div>

              {/* Selector de Fecha */}
              <div className="space-y-1.5">
                <Label htmlFor="checkout-due-date" className="text-xs font-semibold">
                  Fecha de Devolución *
                </Label>
                <div className="relative">
                  <Input
                    id="checkout-due-date"
                    type="date"
                    min={minDateStr}
                    max={maxDateStr}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="border-input text-xs h-10 rounded-xl"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Préstamos de hoy o mañana (hora máxima de retorno: 7:00 PM).
                </p>
              </div>

              {/* Notas de actividad */}
              <div className="space-y-1.5">
                <Label htmlFor="checkout-notes" className="text-xs font-semibold">
                  Observaciones / Actividad
                </Label>
                <Textarea
                  id="checkout-notes"
                  placeholder="Ej. Clase de voleibol, torneo interfacultades..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border-input text-xs resize-none rounded-xl"
                  rows={2}
                />
              </div>

              {error && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              {user?.role !== 'admin' && user?.requiere_completar_perfil && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 py-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-xs flex flex-col gap-2">
                    <span>Requieres carnet y carrera para solicitar material.</span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => router.push('/completar-perfil')}
                      className="bg-amber-600 text-white hover:bg-amber-700 h-8 text-xs font-bold rounded-lg"
                    >
                      Completar Perfil
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Botón de conversión principal */}
              <div className="pt-2">
                {user?.role !== 'admin' && user?.requiere_completar_perfil ? (
                  <Button
                    type="button"
                    onClick={() => router.push('/completar-perfil')}
                    className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
                  >
                    Completar Perfil para Prestar
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full h-11 bg-[#1b4931] hover:bg-[#163c28] text-white font-bold rounded-xl shadow-sm gap-2 transition-all"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      'Procesando solicitud...'
                    ) : (
                      <>
                        <span>Confirmar y Generar Solicitud</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Genera tu ticket con código QR para ventanilla</span>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
