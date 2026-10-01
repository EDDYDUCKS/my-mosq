'use client';

import React, { useState } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { useAuth } from '@/lib/auth-context';
import { completarPerfilApi, fetchSanctions } from '@/lib/api-client';
import { Sanction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Home,
  ShoppingCart,
  FileText,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  CreditCard,
  Mail,
  Calendar,
  Edit2,
  ShieldCheck,
  Building2,
} from 'lucide-react';

const CARRERAS_MAP: Record<string, string> = {
  LAF: 'Licenciatura Administrativa con Énfasis en Finanzas (LAF)',
  LCM: 'Licenciatura Comercial con Énfasis en Mercadeo (LCM)',
  IGI: 'Ingeniería en Gestión Industrial (IGI)',
  ICE: 'Ingeniería Cibernética Electrónica (ICE)',
  IME: 'Ingeniería Mecánica y Energías Renovables (IME)',
  IMS: 'Ingeniería Mecatrónica y Sistemas de Control (IMS)',
  IEM: 'Ingeniería Electromédica (IEM)',
};

const CARRERAS_LIST = [
  { value: 'LAF', label: 'Licenciatura Administrativa con Énfasis en Finanzas (LAF)' },
  { value: 'LCM', label: 'Licenciatura Comercial con Énfasis en Mercadeo (LCM)' },
  { value: 'IGI', label: 'Ingeniería en Gestión Industrial (IGI)' },
  { value: 'ICE', label: 'Ingeniería Cibernética Electrónica (ICE)' },
  { value: 'IME', label: 'Ingeniería Mecánica y Energías Renovables (IME)' },
  { value: 'IMS', label: 'Ingeniería Mecatrónica y Sistemas de Control (IMS)' },
  { value: 'IEM', label: 'Ingeniería Electromédica (IEM)' },
];

const ANOS_LIST = [
  { value: '1', label: '1er Año' },
  { value: '2', label: '2do Año' },
  { value: '3', label: '3er Año' },
  { value: '4', label: '4to Año' },
  { value: '5', label: '5to Año' },
];

export default function StudentProfilePage() {
  const { user, refreshUser } = useAuth();
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [loadingSanctions, setLoadingSanctions] = useState(true);

  // Modal de edición
  const [isEditing, setIsEditing] = useState(false);
  const [carnet, setCarnet] = useState(user?.carnet || '');
  const [carrera, setCarrera] = useState(user?.carrera || '');
  const [anoCursado, setAnoCursado] = useState(user?.ano_cursado || '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  React.useEffect(() => {
    let isMounted = true;
    fetchSanctions()
      .then((data) => {
        if (isMounted) setSanctions(data.filter((s) => s.isActive));
      })
      .catch(() => {
        if (isMounted) setSanctions([]);
      })
      .finally(() => {
        if (isMounted) setLoadingSanctions(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const openEditModal = () => {
    setCarnet(user?.carnet || '');
    setCarrera(user?.carrera || '');
    setAnoCursado(user?.ano_cursado || '');
    setErrorMsg('');
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCarnet = carnet.trim();

    if (!cleanCarnet || !carrera || !anoCursado) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }

    if (cleanCarnet.length < 4 || cleanCarnet.length > 25) {
      setErrorMsg('El carnet debe tener entre 4 y 25 caracteres (ej: 24-0012).');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      await completarPerfilApi(cleanCarnet, carrera, anoCursado);
      await refreshUser();
      setIsEditing(false);
      setSuccessMsg('Información académica actualizada correctamente.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar los datos.');
    } finally {
      setSaving(false);
    }
  };

  const navItems = [
    { label: 'Inicio', href: '/dashboard', icon: <Home className="w-4 h-4" /> },
    { label: 'Catálogo', href: '/prestamos', icon: <ShoppingCart className="w-4 h-4" /> },
    { label: 'Mis Préstamos', href: '/dashboard/loans', icon: <FileText className="w-4 h-4" /> },
    { label: 'Mi Perfil', href: '/perfil', icon: <UserIcon className="w-4 h-4" /> },
  ];

  const carreraNombre = user?.carrera
    ? CARRERAS_MAP[user.carrera.toUpperCase()] || user.carrera
    : 'No registrada';

  const anoNombre = user?.ano_cursado ? `${user.ano_cursado}° Año` : 'No registrado';

  return (
    <ProtectedLayout allowedRoles={['student']}>
      <AppHeader title="Mi Perfil" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-mobile-nav">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Perfil del Estudiante</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Consulta tu identidad institucional y el estado de tu cuenta de préstamos
              </p>
            </div>
            <Button
              onClick={openEditModal}
              variant="outline"
              className="gap-2 rounded-xl text-xs font-semibold"
            >
              <Edit2 className="w-3.5 h-3.5" /> Editar Datos
            </Button>
          </div>

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tarjeta Principal de Identidad */}
          <Card className="rounded-2xl border-border bg-card shadow-xs overflow-hidden">
            <div className="h-28 bg-gradient-to-r from-[#123824] via-[#1b4931] to-[#245e3f] p-6 flex items-end">
              <div className="translate-y-8 flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-card border-4 border-card flex items-center justify-center text-2xl font-black text-[#1b4931] dark:text-emerald-400 shadow-md">
                  {(user?.name || 'E').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            <CardContent className="pt-10 pb-6 px-6 sm:px-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-foreground leading-tight">{user?.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> {user?.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-[#1b4931]/10 text-[#1b4931] dark:bg-emerald-950/60 dark:text-emerald-300 border-[#1b4931]/30 font-semibold text-xs">
                    Estudiante Regular
                  </Badge>
                  {sanctions.length === 0 ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-xs gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Al Día
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800 text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" /> Sanción Activa
                    </Badge>
                  )}
                </div>
              </div>

              {/* Grid de Datos Académicos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
                <div className="p-4 rounded-xl bg-muted/30 border border-border/60">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-1">
                    <CreditCard className="w-4 h-4 text-[#1b4931] dark:text-emerald-400" />
                    <span>Carnet Universitario</span>
                  </div>
                  <p className="text-base font-bold text-foreground font-mono">
                    {user?.carnet || 'Sin registrar'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 sm:col-span-2">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-1">
                    <GraduationCap className="w-4 h-4 text-[#1b4931] dark:text-emerald-400" />
                    <span>Carrera Universitaria</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {carreraNombre}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-1">
                    <Calendar className="w-4 h-4 text-[#1b4931] dark:text-emerald-400" />
                    <span>Año Académico</span>
                  </div>
                  <p className="text-base font-bold text-foreground">
                    {anoNombre}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 sm:col-span-2">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-1">
                    <Building2 className="w-4 h-4 text-[#1b4931] dark:text-emerald-400" />
                    <span>Campus Universitario</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Universidad Tecnológica La Salle (ULSA - León, Nicaragua)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estado de Préstamos y Sanciones */}
          <Card className="rounded-2xl border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1b4931] dark:text-emerald-400" />
                <span>Estado de Acceso al Servicio de Deportes</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Normativas y habilitación de préstamos de material deportivo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sanctions.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground/90 space-y-1">
                    <p className="font-bold text-emerald-900 dark:text-emerald-200">
                      Cuenta habilitada sin restricciones
                    </p>
                    <p className="text-muted-foreground">
                      Tu perfil se encuentra en regla. Puedes solicitar balones, raquetas, redes y accesorios deportivos desde el catálogo digital.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {sanctions.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 flex items-start gap-3 text-xs"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="font-bold text-red-900 dark:text-red-200">
                          Sanción activa: {s.reason}
                        </p>
                        <p className="text-muted-foreground">
                          Severidad: <span className="capitalize font-semibold text-foreground">{s.severity}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal para editar datos académicos */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Actualizar Datos Académicos</DialogTitle>
            <DialogDescription className="text-xs">
              Modifica tu carnet o año de cursado si cambiaste de ciclo académico
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-carnet" className="text-xs font-semibold">
                Número de Carnet
              </Label>
              <Input
                id="edit-carnet"
                placeholder="Ej: 24-0012"
                value={carnet}
                onChange={(e) => setCarnet(e.target.value)}
                className="rounded-xl border-border text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Carrera</Label>
              <Select value={carrera} onValueChange={setCarrera}>
                <SelectTrigger className="rounded-xl border-border text-xs">
                  <SelectValue placeholder="Selecciona tu carrera" />
                </SelectTrigger>
                <SelectContent>
                  {CARRERAS_LIST.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Año Cursado</Label>
              <Select value={anoCursado} onValueChange={setAnoCursado}>
                <SelectTrigger className="rounded-xl border-border text-xs">
                  <SelectValue placeholder="Selecciona el año que cursas" />
                </SelectTrigger>
                <SelectContent>
                  {ANOS_LIST.map((a) => (
                    <SelectItem key={a.value} value={a.value} className="text-xs">
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {errorMsg && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </p>
            )}

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#1b4931] hover:bg-[#163c28] text-white font-semibold rounded-xl text-xs"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ProtectedLayout>
  );
}
