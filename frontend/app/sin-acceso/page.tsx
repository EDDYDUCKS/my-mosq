'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WifiOff, Lock, ArrowLeft, KeyRound } from 'lucide-react';

// ── Configuración de la puerta secreta ──────────────────────────────────────
const SECRET_TAPS   = 6;          // cuántos toques necesarios
const SECRET_PIN    = '0805';     // PIN correcto
const BYPASS_COOKIE = 'mosq_bypass';
const BYPASS_TOKEN  = 'ulsa-dev-2025'; // valor de la cookie (sólo lo conocemos nosotros)
const COOKIE_DAYS   = 30;         // cuánto dura el bypass en este dispositivo

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`;
}

export default function SinAccesoPage() {
  const router = useRouter();
  const [taps, setTaps]           = useState(0);
  const [pinOpen, setPinOpen]     = useState(false);
  const [pin, setPin]             = useState('');
  const [shake, setShake]         = useState(false);
  const [success, setSuccess]     = useState(false);

  const handleIconTap = () => {
    const next = taps + 1;
    setTaps(next);
    if (next >= SECRET_TAPS) {
      setTaps(0);
      setPinOpen(true);
      setPin('');
    }
  };

  const handlePinSubmit = () => {
    if (pin === SECRET_PIN) {
      setCookie(BYPASS_COOKIE, BYPASS_TOKEN, COOKIE_DAYS);
      setSuccess(true);
      setTimeout(() => router.replace('/'), 1500);
    } else {
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex flex-col items-center justify-center p-6 text-white">

      {/* Ícono central — toca 6 veces para activar */}
      <div className="relative mb-8 cursor-pointer select-none" onClick={handleIconTap}>
        <div className="w-28 h-28 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm transition-transform active:scale-90">
          <WifiOff className="w-14 h-14 text-red-400" />
        </div>
        <span className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-ping" />
        <span className="absolute inset-2 rounded-full border border-red-500/20 animate-ping [animation-delay:300ms]" />

        {/* Contador invisible (pequeño punto que crece con cada toque) */}
        {taps > 0 && taps < SECRET_TAPS && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold text-white/60">
            {taps}
          </span>
        )}
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-center mb-3 tracking-tight">
        Acceso Restringido
      </h1>
      <p className="text-white/60 text-center text-base sm:text-lg max-w-md mb-8">
        MOSQ solo está disponible dentro de la red WiFi de la universidad.
        Conéctate al WiFi del campus e intenta de nuevo.
      </p>

      {/* Tarjeta informativa */}
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm space-y-4 mb-8">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Red requerida</p>
            <p className="text-white/50 text-xs mt-0.5">
              Debes estar conectado a la red WiFi de ULSA Nicaragua para acceder al sistema de préstamos.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <WifiOff className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Tu conexión actual no está autorizada</p>
            <p className="text-white/50 text-xs mt-0.5">
              Si estás en el campus, asegúrate de estar en el WiFi institucional y no en datos móviles.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 bg-white text-[#0f3460] font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Reintentar acceso
      </button>

      <p className="text-white/30 text-xs text-center">
        MOSQ · Sistema de Préstamos — ULSA Nicaragua
      </p>

      {/* ── MODAL SECRETO DE PIN ─────────────────────────────────────────── */}
      {pinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className={`bg-[#1a1a2e] border border-white/10 rounded-2xl p-8 w-full max-w-xs text-center shadow-2xl
              transition-transform
              ${shake ? 'animate-[wiggle_0.4s_ease-in-out]' : ''}
              ${success ? 'border-green-500/50' : ''}`}
            style={shake ? { animation: 'wiggle 0.4s ease-in-out' } : {}}
          >
            {success ? (
              /* Éxito */
              <div className="space-y-3">
                <div className="text-5xl">✅</div>
                <p className="text-green-400 font-bold text-lg">Acceso concedido</p>
                <p className="text-white/50 text-sm">Redirigiendo…</p>
              </div>
            ) : (
              /* Formulario PIN */
              <div className="space-y-5">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                  <KeyRound className="w-7 h-7 text-yellow-400" />
                </div>
                <div>
                  <p className="font-bold text-lg">Acceso especial</p>
                  <p className="text-white/50 text-xs mt-1">Ingresa el PIN de administrador</p>
                </div>

                {/* Puntos del PIN */}
                <div className="flex justify-center gap-3 mb-2">
                  {[0,1,2,3].map(i => (
                    <span
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all ${
                        pin.length > i ? 'bg-yellow-400 scale-125' : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                {/* Teclado numérico */}
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6,7,8,9].map(n => (
                    <button
                      key={n}
                      onClick={() => pin.length < 4 && setPin(p => p + n)}
                      className="h-12 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-lg font-bold transition-colors"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPin(p => p.slice(0, -1))}
                    className="h-12 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/60 transition-colors"
                  >
                    ⌫
                  </button>
                  <button
                    onClick={() => pin.length < 4 && setPin(p => p + '0')}
                    className="h-12 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-lg font-bold transition-colors"
                  >
                    0
                  </button>
                  <button
                    onClick={handlePinSubmit}
                    disabled={pin.length < 4}
                    className="h-12 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold text-lg transition-colors"
                  >
                    ✓
                  </button>
                </div>

                <button
                  onClick={() => { setPinOpen(false); setPin(''); }}
                  className="text-white/30 text-xs hover:text-white/50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Animación wiggle inline */}
      <style>{`
        @keyframes wiggle {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-10px); }
          40%      { transform: translateX(10px); }
          60%      { transform: translateX(-7px); }
          80%      { transform: translateX(7px); }
        }
      `}</style>
    </div>
  );
}
