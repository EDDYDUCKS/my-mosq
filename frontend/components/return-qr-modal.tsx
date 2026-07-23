'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, CheckCircle2, Loader2 } from 'lucide-react';
import { fetchLoanById } from '@/lib/api-client';

interface ReturnQrModalProps {
  loanId: string | null;
  equipmentNames: string[];
  onClose: () => void;
}

type ModalState = 'showing' | 'returned';

export function ReturnQrModal({ loanId, equipmentNames, onClose }: ReturnQrModalProps) {
  const [state, setState]   = useState<ModalState>('showing');
  const intervalRef         = useRef<NodeJS.Timeout | null>(null);

  // Polling para detectar cuando el admin marca como devuelto
  useEffect(() => {
    if (!loanId) {
      setState('showing');
      return;
    }

    setState('showing');

    const check = async () => {
      try {
        const loans = await fetchLoanById(loanId);
        if (!loans.length) return;
        const bs = (loans[0] as { backendStatus?: string }).backendStatus;
        if (bs === 'DEVUELTO') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setState('returned');
        }
      } catch { /* silencioso */ }
    };

    check();
    intervalRef.current = setInterval(check, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loanId]);

  const handleClose = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState('showing');
    onClose();
  };

  // ── PANTALLA DEVUELTO ──
  if (state === 'returned') {
    return (
      <Dialog open={!!loanId} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="flex flex-col items-center py-4 gap-4">
            <CheckCircle2 className="w-20 h-20 text-green-500 animate-bounce" />
            <h2 className="text-2xl font-extrabold text-green-800 dark:text-green-200">
              ¡Devolución Registrada!
            </h2>
            <p className="text-sm text-muted-foreground">
              El encargado recibió tu equipo. Gracias por devolver a tiempo.
            </p>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white px-8"
              onClick={handleClose}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── PANTALLA QR ──
  return (
    <Dialog open={!!loanId} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-lg">
            <Package className="w-5 h-5 text-green-600" />
            Devolver Equipo
          </DialogTitle>
          <DialogDescription className="text-center">
            Muestra este QR al encargado de la bodega para registrar la devolución.
          </DialogDescription>
        </DialogHeader>

        {equipmentNames.length > 0 && (
          <div className="bg-muted rounded-lg px-4 py-2 text-sm text-foreground text-left">
            <p className="font-semibold text-xs text-muted-foreground uppercase mb-1">Devolviendo:</p>
            <ul className="space-y-0.5">
              {equipmentNames.map((name, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {loanId && (
          <div className="flex justify-center">
            <div className="bg-white p-5 rounded-2xl shadow-lg border border-border">
              <QRCode
                value={`MOSQ-LOAN-${loanId}`}
                size={200}
                bgColor="#ffffff"
                fgColor="#166534"
              />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">Ticket #{loanId}</p>

        {/* Indicador de espera */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Esperando confirmación del encargado…
        </div>
      </DialogContent>
    </Dialog>
  );
}
