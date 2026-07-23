'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { useAuth } from '@/lib/auth-context';
import { fetchStudentLoans, fetchSanctions } from '@/lib/api-client';
import { LoanRequest, Sanction } from '@/lib/types';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Home, ShoppingCart, FileText,
  AlertTriangle, Clock, CheckCircle2, Package, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReturnQrModal } from '@/components/return-qr-modal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVO:    { label: 'Activo',     color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',   icon: <Clock className="w-3.5 h-3.5" /> },
  PENDIENTE: { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: <Clock className="w-3.5 h-3.5" /> },
  DEVUELTO:  { label: 'Devuelto',   color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ATRASADO:  { label: 'Atrasado',   color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',      icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  RECHAZADO: { label: 'Rechazado',  color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',   icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

export default function StudentHome() {
  const { user } = useAuth();
  const router   = useRouter();
  const [loans, setLoans]         = useState<LoanRequest[]>([]);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [loading, setLoading]     = useState(true);
  const [returnModal, setReturnModal] = useState<{ id: string; items: string[] } | null>(null);

  const firstName = user?.firstName || user?.email?.split('@')[0] || 'Estudiante';

  // ── GUARDÁN DE PERSISTENCIA: si el estudiante tiene un préstamo pendiente, lo mandamos de regreso ──
  useEffect(() => {
    const pendingId = localStorage.getItem('mosq_pending_loan_id');
    if (pendingId) {
      // Verificar con el backend que el préstamo sigue pendiente
      fetchStudentLoans()
        .then(loans => {
          const match = loans.find(l => (l.loanGroupId ?? l.id) === pendingId);
          const bs = match ? (match as { backendStatus?: string }).backendStatus : null;
          if (match && (bs === 'PENDIENTE')) {
            router.replace(`/espera/${pendingId}`);
          } else {
            localStorage.removeItem('mosq_pending_loan_id');
          }
        })
        .catch(() => localStorage.removeItem('mosq_pending_loan_id'));
    }
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([fetchStudentLoans(), fetchSanctions()]);
      setLoans(l);
      setSanctions(s.filter(sa => sa.isActive));
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresco cada 10 segundos
  useAutoRefresh(loadData, 10_000);

  // Agrupar por prestamo principal (loanGroupId)
  const activeGroups = useMemo(() => {
    const map = new Map<string, { status: string; dueDate: Date; items: string[] }>();
    for (const l of loans) {
      const gid = l.loanGroupId ?? l.id;
      const bs  = (l as { backendStatus?: string }).backendStatus ?? l.status.toUpperCase();
      if (bs === 'ACTIVO' || bs === 'PENDIENTE' || bs === 'ATRASADO') {
        if (!map.has(gid)) map.set(gid, { status: bs, dueDate: new Date(l.dueDate), items: [] });
        map.get(gid)!.items.push(l.equipmentName);
      }
    }
    return Array.from(map.entries());
  }, [loans]);

  // Gráfico: top 5 equipos más pedidos por el estudiante
  const topEquipmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of loans) {
      counts[l.equipmentName] = (counts[l.equipmentName] || 0) + l.quantity;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, Pedidos: count }))
      .sort((a, b) => b.Pedidos - a.Pedidos)
      .slice(0, 5);
  }, [loans]);

  // Gráfico: historial por estado
  const historialData = useMemo(() => {
    const counts = { DEVUELTO: 0, ACTIVO: 0, PENDIENTE: 0, ATRASADO: 0, RECHAZADO: 0 };
    const uniqueGroups = new Map<string, string>();
    for (const l of loans) {
      const gid = l.loanGroupId ?? l.id;
      const bs  = (l as { backendStatus?: string }).backendStatus ?? l.status.toUpperCase();
      if (!uniqueGroups.has(gid)) uniqueGroups.set(gid, bs);
    }
    for (const st of uniqueGroups.values()) {
      if (st in counts) counts[st as keyof typeof counts]++;
    }
    return [
      { name: 'Devueltos',  value: counts.DEVUELTO,  color: '#22c55e' },
      { name: 'Activos',    value: counts.ACTIVO,     color: '#3b82f6' },
      { name: 'Pendientes', value: counts.PENDIENTE,  color: '#eab308' },
      { name: 'Atrasados',  value: counts.ATRASADO,   color: '#ef4444' },
      { name: 'Rechazados', value: counts.RECHAZADO,  color: '#6b7280' },
    ].filter(d => d.value > 0);
  }, [loans]);

  const navItems = [
    { label: 'Inicio',         href: '/dashboard',       icon: <Home className="w-4 h-4" /> },
    { label: 'Catálogo',       href: '/prestamos',        icon: <ShoppingCart className="w-4 h-4" /> },
    { label: 'Mis Préstamos',  href: '/dashboard/loans',  icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <ProtectedLayout allowedRoles={['student']}>
      <AppHeader title="Mi Panel" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-mobile-nav space-y-6 sm:space-y-8">

          {/* ── BIENVENIDA ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 p-5 sm:p-8 text-white shadow-lg">
            <div className="relative z-10">
              <p className="text-green-200 text-xs sm:text-sm font-medium mb-1">Bienvenido de vuelta 👋</p>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">{firstName}</h1>
              <p className="mt-1 sm:mt-2 text-green-100 max-w-md text-sm sm:text-base">
                Aquí puedes ver el resumen de tus préstamos y estadísticas personales.
              </p>
              <Link
                href="/prestamos"
                className="mt-3 sm:mt-4 inline-flex items-center gap-2 bg-white text-green-700 font-semibold text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl hover:bg-green-50 transition-colors shadow"
              >
                <Package className="w-4 h-4" /> Ir al Catálogo
              </Link>
            </div>
            {/* decoración */}
            <div className="absolute -right-12 -top-12 w-36 sm:w-56 h-36 sm:h-56 bg-white/10 rounded-full" />
            <div className="absolute -right-4 -bottom-8 w-24 sm:w-36 h-24 sm:h-36 bg-white/10 rounded-full" />
          </div>

          {/* ── ALERTAS DE SANCIONES ── */}
          {sanctions.length > 0 && (
            <div className="space-y-3">
              {sanctions.map(s => (
                <div
                  key={s.id}
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50 p-4"
                >
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800 dark:text-red-300">Sanción Activa</p>
                    <p className="text-sm text-red-700 dark:text-red-400">{s.reason}</p>
                    {s.notes && <p className="text-xs text-red-500 mt-1">{s.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── PRÉSTAMOS ACTIVOS / PENDIENTES ── */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" /> Equipos en tu Poder
            </h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : activeGroups.length === 0 ? (
              <Card className="border border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  No tienes equipos prestados en este momento.{' '}
                  <Link href="/prestamos" className="text-green-600 font-medium hover:underline">
                    ¡Solicita uno!
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeGroups.map(([gid, g]) => {
                  const info   = STATUS_MAP[g.status] ?? STATUS_MAP['PENDIENTE'];
                  const today  = new Date();
                  const diff   = Math.ceil((g.dueDate.getTime() - today.getTime()) / 86_400_000);
                  const urgent = diff <= 0;
                  return (
                    <Card
                      key={gid}
                      className={`border transition-shadow hover:shadow-md ${urgent ? 'border-red-300 dark:border-red-700' : ''}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Solicitud #{gid}</CardTitle>
                          <Badge className={info.color}>
                            <span className="flex items-center gap-1">{info.icon} {info.label}</span>
                          </Badge>
                        </div>
                        <CardDescription>
                          {g.items.join(', ')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-sm font-medium mb-3 ${urgent ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {urgent
                            ? '⚠️ ¡Fecha de devolución vencida!'
                            : `Devolver antes del ${g.dueDate.toLocaleDateString('es-NI')} (${diff} día${diff === 1 ? '' : 's'})`}
                        </div>
                        {/* Solo mostrar botón devolver si está ACTIVO o ATRASADO */}
                        {(g.status === 'ACTIVO' || g.status === 'ATRASADO') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-green-600 text-green-700 hover:bg-green-600 hover:text-white gap-2"
                            onClick={() => setReturnModal({ id: gid, items: g.items })}
                          >
                            <RotateCcw className="w-4 h-4" /> Devolver Equipo
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── GRÁFICOS PERSONALES ── */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">Mis Estadísticas</h2>
            {loans.length === 0 && !loading ? (
              <Card className="border border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  Aún no tienes historial de préstamos. ¡Tu gráfico aparecerá aquí cuando solicites tu primer equipo!
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Barra: mis equipos favoritos */}
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>Mis Equipos Favoritos</CardTitle>
                    <CardDescription>Los que más has pedido</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full">
                      {topEquipmentData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topEquipmentData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                            <Tooltip
                              cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="Pedidos" fill="#166534" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          Sin datos suficientes
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Donut: historial por estado */}
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>Historial de Préstamos</CardTitle>
                    <CardDescription>Resumen de todos tus tickets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full">
                      {historialData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={historialData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {historialData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          Sin datos suficientes
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>

        </div>
      </main>

      <ReturnQrModal
        loanId={returnModal?.id ?? null}
        equipmentNames={returnModal?.items ?? []}
        onClose={() => setReturnModal(null)}
      />
    </ProtectedLayout>
  );
}
