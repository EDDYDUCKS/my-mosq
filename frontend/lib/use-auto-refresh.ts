import { useEffect, useRef, useCallback } from 'react';

/**
 * Ejecuta `refreshFn` inmediatamente y luego cada `intervalMs` milisegundos.
 * Se cancela automáticamente al desmontar el componente.
 */
export function useAutoRefresh(refreshFn: () => void, intervalMs = 10_000) {
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn;              // siempre apunta a la versión más reciente

  const stable = useCallback(() => {
    fnRef.current();
  }, []);

  useEffect(() => {
    stable();                             // carga inicial
    const id = setInterval(stable, intervalMs);
    return () => clearInterval(id);
  }, [stable, intervalMs]);
}
