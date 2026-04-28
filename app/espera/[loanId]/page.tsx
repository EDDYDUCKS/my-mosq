'use client';

import React, { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchLoanById, updateLoanStatus } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import QRCode from 'react-qr-code';
import { Loader2, XCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

const PENDING_LOAN_KEY = 'mosq_pending_loan_id';

type ScreenState = 'waiting' | 'approved' | 'rejected';

function EsperaContent() {
  const { loanId } = useParams<{ loanId: string }>();
  const router = useRouter();
  const [screen, setScreen]             = useState<ScreenState>('waiting');
  const [rejectionReason, setRejection] = useState<string>('');
  const [cancelling, setCancelling]     = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Guardar en localStorage para persistencia
  useEffect(() => {
    if (loanId) localStorage.setItem(PENDING_LOAN_KEY, loanId);
  }, [loanId]);

  // Polling cada 5 segundos
  const poll = useCallback(async () => {
    if (!loanId) return;
    try {
      const loans = await fetchLoanById(loanId);
      if (!loans.length) return;
      const loan = loans[0];
      const bs   = (loan as { backendStatus?: string }).backendStatus;

      if (bs === 'ACTIVO') {
        localStorage.removeItem(PENDING_LOAN_KEY);
        setScreen('approved');
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else if (bs === 'RECHAZADO') {
        localStorage.removeItem(PENDING_LOAN_KEY);
        // Intentar mostrar el motivo desde 'notes' u observaciones
        const maybeNotes = (loan as { notes?: string; observations?: string }).notes
          || (loan as { observations?: string }).observations
          || '';
        setRejection(maybeNotes);
        setScreen('rejected');
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch {
      // silencioso: seguir intentando
    }
  }, [loanId]);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [poll]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await updateLoanStatus(loanId, 'RECHAZADO', 'Cancelado por el estudiante');
      localStorage.removeItem(PENDING_LOAN_KEY);
      router.push('/prestamos');
    } catch {
      setCancelling(false);
    }
  };

  // ── PANTALLA APROBADO ──
  if (screen === 'approved') {
    return (
      <div className="fixed inset-0 z-[100] bg-green-50 dark:bg-green-950 flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="w-24 h-24 text-green-500 mb-6 animate-bounce" />
        <h1 className="text-4xl font-extrabold text-green-800 dark:text-green-200 mb-3">
          ¡Préstamo Aprobado!
        </h1>
        <p className="text-lg text-green-700 dark:text-green-300 mb-8">
          El encargado aprobó tu solicitud. ¡Ve a recoger tu equipo a la bodega!
        </p>
        <Button
          onClick={() => router.push('/dashboard/loans')}
          className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6"
        >
          Ver mis préstamos
        </Button>
      </div>
    );
  }

  // ── PANTALLA RECHAZADO ──
  if (screen === 'rejected') {
    return (
      <div className="fixed inset-0 z-[100] bg-red-50 dark:bg-red-950 flex flex-col items-center justify-center p-8 text-center">
        <XCircle className="w-24 h-24 text-red-500 mb-6" />
        <h1 className="text-4xl font-extrabold text-red-800 dark:text-red-200 mb-3">
          Préstamo Rechazado
        </h1>
        {rejectionReason ? (
          <div className="bg-white dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-xl px-6 py-4 mb-8 max-w-md">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Motivo:</p>
            <p className="text-red-800 dark:text-red-200">{rejectionReason}</p>
          </div>
        ) : (
          <p className="text-lg text-red-700 dark:text-red-300 mb-8">
            Tu solicitud fue rechazada por el administrador.
          </p>
        )}
        <Button
          onClick={() => router.push('/prestamos')}
          className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-6"
        >
          Volver al Catálogo
        </Button>
      </div>
    );
  }

  // ── PANTALLA ESPERANDO ──
  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6">
      {/* Indicador de pulso */}
      <div className="flex items-center gap-3 mb-8">
        <span className="relative flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
        </span>
        <p className="text-lg font-semibold text-muted-foreground">
          Esperando respuesta del administrador…
        </p>
      </div>

      {/* QR */}
      <div className="bg-white p-6 rounded-2xl shadow-2xl border border-border mb-6">
        <QRCode
          value={`MOSQ-LOAN-${loanId}`}
          size={220}
          bgColor="#ffffff"
          fgColor="#166534"
        />
      </div>

      <div className="text-center mb-2">
        <p className="text-sm font-bold text-foreground">Ticket #{loanId}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Muestra este código QR al encargado de la bodega para recibir tu equipo
        </p>
      </div>

      {/* Aviso */}
      <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3 mt-4 max-w-sm text-center">
        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          No cierres esta pantalla. Si recargas la página volverás aquí automáticamente.
        </p>
      </div>

      {/* Cancelar */}
      <Button
        variant="outline"
        className="mt-8 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-500"
        onClick={handleCancel}
        disabled={cancelling}
      >
        {cancelling ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelando…</>
        ) : (
          <><XCircle className="w-4 h-4 mr-2" /> Cancelar mi solicitud</>
        )}
      </Button>
    </div>
  );
}

export default function EsperaPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-green-600" />
      </div>
    }>
      <EsperaContent />
    </Suspense>
  );
}
