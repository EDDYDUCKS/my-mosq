'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { completarPerfilApi } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, LogOut, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CompletarPerfilPage() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const [carnet, setCarnet] = useState(user?.carnet || '');
  const [carrera, setCarrera] = useState(user?.carrera || '');
  const [anoCursado, setAnoCursado] = useState(user?.ano_cursado || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Sincronizar datos si el usuario carga después del montaje
  useEffect(() => {
    if (user) {
      if (user.carnet && !carnet) setCarnet(user.carnet);
      if (user.carrera && !carrera) setCarrera(user.carrera);
      if (user.ano_cursado && !anoCursado) setAnoCursado(user.ano_cursado);

      // Si es admin, redirigir a su panel
      if (user.role === 'admin') {
        router.replace('/admin');
      }
    }
  }, [user]);

  const CARRERAS = [
    { value: 'LAF', label: 'Licenciatura Administrativa con Énfasis en Finanzas (LAF)' },
    { value: 'LCM', label: 'Licenciatura Comercial con Énfasis en Mercadeo (LCM)' },
    { value: 'IGI', label: 'Ingeniería en Gestión Industrial (IGI)' },
    { value: 'ICE', label: 'Ingeniería Cibernética Electrónica (ICE)' },
    { value: 'IME', label: 'Ingeniería Mecánica y Energías Renovables (IME)' },
    { value: 'IMS', label: 'Ingeniería Mecatrónica y Sistemas de Control (IMS)' },
    { value: 'IEM', label: 'Ingeniería Electromédica (IEM)' },
  ];

  const ANOS = [
    { value: '1', label: '1er Año' },
    { value: '2', label: '2do Año' },
    { value: '3', label: '3er Año' },
    { value: '4', label: '4to Año' },
    { value: '5', label: '5to Año' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCarnet = carnet.trim();

    if (!cleanCarnet || !carrera || !anoCursado) {
      setError('Por favor llena todos los campos.');
      return;
    }

    if (cleanCarnet.length < 4 || cleanCarnet.length > 25) {
      setError('El carnet debe tener entre 4 y 25 caracteres (ej: 24-0012 o 2024-0012).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await completarPerfilApi(cleanCarnet, carrera, anoCursado);
      setSuccess(true);
      await refreshUser();
      setTimeout(() => {
        router.push('/dashboard');
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Error al guardar el perfil.');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-wide uppercase">
              <ShieldCheck className="w-4 h-4" />
              <span>Registro Estudiantil Obligatorio</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <CardTitle className="text-2xl font-bold">Completar tu Perfil</CardTitle>
          <CardDescription>
            Para poder solicitar préstamos de equipo deportivo en MOSQ, es obligatorio registrar tu carnet, carrera y año actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="py-8 text-center space-y-3 animate-in fade-in">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <h3 className="font-bold text-lg">¡Perfil completado con éxito!</h3>
              <p className="text-sm text-muted-foreground">Redirigiendo a tu panel...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="carnet">Número de Carnet</Label>
                <Input
                  id="carnet"
                  placeholder="Ej. 24-0012 o 2024-0012"
                  value={carnet}
                  onChange={(e) => setCarnet(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Ingresa tu código oficial asignado por registro académico.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="carrera">Carrera</Label>
                <Select value={carrera} onValueChange={setCarrera} required>
                  <SelectTrigger id="carrera">
                    <SelectValue placeholder="Selecciona tu carrera" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRERAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ano">Año que cursas</Label>
                <Select value={anoCursado} onValueChange={setAnoCursado} required>
                  <SelectTrigger id="ano">
                    <SelectValue placeholder="Selecciona tu año" />
                  </SelectTrigger>
                  <SelectContent>
                    {ANOS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? 'Guardando perfil...' : 'Guardar y Continuar'}
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Cerrar sesión o usar otra cuenta
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
