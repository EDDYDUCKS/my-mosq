'use client';

import React, { useEffect, useRef, useState } from 'react';
import { updateLoanStatus, markLoanAsReturned } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, CheckCircle2, XCircle, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';

type ScanMode = 'approve' | 'return';
type ScanResult = { status: 'success' | 'error'; message: string } | null;

interface QrScannerProps {
  onReturnScanned?: (loanId: string) => void;
}

export function QrScanner({ onReturnScanned }: QrScannerProps = {}) {
  const [active, setActive]     = useState(false);
  const [mode, setMode]         = useState<ScanMode>('approve');
  const [result, setResult]     = useState<ScanResult>(null);
  const [processing, setProc]   = useState(false);
  const [camError, setCamError] = useState('');
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const divId = 'mosq-qr-reader-live';

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* ya estaba detenida */ }
      scannerRef.current = null;
    }
  };

  const startCamera = async () => {
    setCamError('');
    setResult(null);

    try {
      // Import dinámico: evita SSR crash
      const { Html5Qrcode } = await import('html5-qrcode');

      const qr = new Html5Qrcode(divId);

      await qr.start(
        { facingMode: 'environment' },          // cámara trasera; en laptop usa la webcam automáticamente
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText: string) => {
          // Sólo procesar una vez
          if (processing) return;

          const match = decodedText.match(/^MOSQ-LOAN-(\d+)$/);
          if (!match) {
            // QR no es de MOSQ, ignorar
            return;
          }

          const loanId = match[1];
          setProc(true);
          await stopCamera();
          setActive(false);

          try {
            if (mode === 'approve') {
              await updateLoanStatus(loanId, 'ACTIVO');
              setResult({ status: 'success', message: `✅ Préstamo #${loanId} aprobado. Equipo entregado.` });
            } else {
              if (onReturnScanned) {
                onReturnScanned(loanId);
                setResult({ status: 'success', message: `✅ Código QR capturado para devolución.` });
              } else {
                await markLoanAsReturned(loanId);
                setResult({ status: 'success', message: `✅ Préstamo #${loanId} marcado como devuelto.` });
              }
            }
            // Bip de confirmación
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              osc.connect(ctx.destination);
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              osc.start();
              osc.stop(ctx.currentTime + 0.15);
            } catch { /* silencioso */ }
          } catch (err) {
            setResult({
              status: 'error',
              message: err instanceof Error ? err.message : 'Error al procesar el préstamo.',
            });
          } finally {
            setProc(false);
          }
        },
        () => { /* errores de frame normales, ignorar */ },
      );

      scannerRef.current = qr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
        setCamError('Permiso de cámara denegado. Permite el acceso en la barra del navegador e intenta de nuevo.');
      } else {
        setCamError(`No se pudo iniciar la cámara: ${msg}`);
      }
      setActive(false);
    }
  };

  // Arrancar/detener según el toggle
  useEffect(() => {
    if (active) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handleToggle = () => {
    if (!active) {
      setResult(null);
      setCamError('');
    }
    setActive(prev => !prev);
  };

  return (
    <div className="space-y-4">

      {/* Toggle modo */}
      <div className="flex items-center gap-3 bg-muted rounded-xl p-3">
        <span className={`text-sm font-medium ${mode === 'approve' ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
          Entregar
        </span>
        <button onClick={() => setMode(m => m === 'approve' ? 'return' : 'approve')}>
          {mode === 'approve'
            ? <ToggleLeft className="w-8 h-8 text-green-600" />
            : <ToggleRight className="w-8 h-8 text-blue-600" />}
        </button>
        <span className={`text-sm font-medium ${mode === 'return' ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground'}`}>
          Recibir Devolución
        </span>
      </div>

      {/* Botón activar cámara */}
      <Button
        onClick={handleToggle}
        disabled={processing}
        className={`w-full gap-2 ${active
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-green-600 hover:bg-green-700 text-white'}`}
      >
        {processing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
        ) : active ? (
          <><CameraOff className="w-4 h-4" /> Detener Cámara</>
        ) : (
          <><Camera className="w-4 h-4" /> Activar Cámara 📷</>
        )}
      </Button>

      {/* SIEMPRE en el DOM — la lib lo necesita para montar el video */}
      <div
        id={divId}
        className={`rounded-xl overflow-hidden border border-border bg-black ${active ? 'block' : 'hidden'}`}
        style={{ minHeight: active ? 280 : 0 }}
      />

      {/* Error de cámara */}
      {camError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-3">
          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{camError}</p>
        </div>
      )}

      {/* Resultado del escaneo */}
      {result && (
        <div className={`rounded-xl p-4 flex items-start gap-3 ${
          result.status === 'success'
            ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
        }`}>
          <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${result.status === 'success' ? 'text-green-600' : 'text-red-600'}`} />
          <p className={`text-sm font-medium ${result.status === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
            {result.message}
          </p>
        </div>
      )}

      {result?.status === 'success' && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => { setResult(null); setActive(true); }}
        >
          Escanear otro QR
        </Button>
      )}
    </div>
  );
}
