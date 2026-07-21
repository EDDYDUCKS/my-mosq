'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Equipment } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { fetchEquipment, createLoan } from '@/lib/api-client';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus } from 'lucide-react';

interface SpecialLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface SelectedEquipment {
  id: string;
  name: string;
  available: number;
  quantity: number;
}

export function SpecialLoanDialog({ open, onOpenChange, onSuccess }: SpecialLoanDialogProps) {
  const { user } = useAuth();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loadingEquipments, setLoadingEquipments] = useState(false);
  
  const [solicitante, setSolicitante] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedEquipment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      loadEquipments();
      // Reset form
      setSolicitante('');
      setDueDate('');
      setNotes('');
      setSelectedItems([]);
      setError('');
    }
  }, [open]);

  const loadEquipments = async () => {
    setLoadingEquipments(true);
    try {
      const data = await fetchEquipment();
      setEquipmentList(data.filter(e => e.available > 0));
    } catch {
      // ignore
    } finally {
      setLoadingEquipments(false);
    }
  };

  const handleToggleEquipment = (eq: Equipment) => {
    setSelectedItems(prev => {
      const exists = prev.find(item => item.id === eq.id);
      if (exists) {
        return prev.filter(item => item.id !== eq.id);
      } else {
        return [...prev, { id: eq.id, name: eq.name, available: eq.available, quantity: 1 }];
      }
    });
  };

  const handleQuantityChange = (id: string, qty: number, available: number) => {
    if (qty < 1) qty = 1;
    if (qty > available) qty = available;
    
    setSelectedItems(prev => 
      prev.map(item => item.id === id ? { ...item, quantity: qty } : item)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!solicitante.trim()) {
      setError('Debes ingresar el nombre del solicitante externo.');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Debes seleccionar al menos un equipo.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await createLoan({
        estudiante: Number(user.id), // Admin themselves
        estado: 'ACTIVO',
        solicitante_externo: solicitante.trim(),
        fecha_devolucion: dueDate || undefined,
        observaciones: notes.trim() || undefined,
        detalles: selectedItems.map(item => ({
          equipo: Number(item.id),
          cantidad: item.quantity,
        })),
      });

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear préstamo especial');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Préstamo Especial</DialogTitle>
          <DialogDescription>
            Crea un préstamo directamente como ACTIVO para entrenadores o personal externo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="solicitante">Nombre del Solicitante *</Label>
            <Input
              id="solicitante"
              placeholder="Ej. Coach Roberto - Equipo de Basketball"
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Fecha de Devolución (Opcional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas / Observaciones (Opcional)</Label>
            <Input
              id="notes"
              placeholder="Ej. Torneo fin de semana"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Equipos Disponibles *</Label>
            {loadingEquipments ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-2">
                {equipmentList.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No hay equipos disponibles en bodega.</p>
                ) : (
                  equipmentList.map(eq => {
                    const isSelected = selectedItems.some(i => i.id === eq.id);
                    const selectedItem = selectedItems.find(i => i.id === eq.id);
                    
                    return (
                      <div key={eq.id} className="flex flex-col gap-2 p-2 bg-muted/50 rounded-md">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id={`eq-${eq.id}`} 
                            checked={isSelected}
                            onCheckedChange={() => handleToggleEquipment(eq)}
                          />
                          <Label htmlFor={`eq-${eq.id}`} className="flex-1 cursor-pointer">
                            {eq.name} <span className="text-muted-foreground font-normal text-xs">(Disp: {eq.available})</span>
                          </Label>
                        </div>
                        {isSelected && (
                          <div className="pl-6 flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Cantidad:</Label>
                            <Input 
                              type="number" 
                              className="w-20 h-7 text-sm"
                              min="1"
                              max={eq.available}
                              value={selectedItem?.quantity || 1}
                              onChange={(e) => handleQuantityChange(eq.id, parseInt(e.target.value) || 1, eq.available)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || loadingEquipments}>
              {isSubmitting ? 'Creando...' : 'Crear Préstamo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
