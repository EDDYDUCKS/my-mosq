'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoanRequest, Equipment, DashboardStats } from '@/lib/types';
import { getDashboardStats } from '@/lib/api-client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardChartsProps {
  loans: LoanRequest[];
  equipment: Equipment[];
}

export function DashboardCharts({ loans }: DashboardChartsProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((err) => console.warn('Error cargando estadísticas del backend:', err));
  }, []);

  // 1. Top Equipos más solicitados (del backend o derivado de loans)
  const topEquipmentData = useMemo(() => {
    if (stats?.top_equipos && stats.top_equipos.length > 0) {
      return stats.top_equipos.slice(0, 5).map((item) => ({
        name: item.nombre,
        Solicitudes: item.total,
      }));
    }

    const counts: Record<string, number> = {};
    loans.forEach((loan) => {
      const name = loan.equipmentName || 'Desconocido';
      counts[name] = (counts[name] || 0) + loan.quantity;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, Solicitudes: count }))
      .sort((a, b) => b.Solicitudes - a.Solicitudes)
      .slice(0, 5);
  }, [stats, loans]);

  // 2. Estado de Préstamos (Pie Chart)
  const statusData = useMemo(() => {
    if (stats?.distribucion_estados) {
      const dist = stats.distribucion_estados;
      return [
        { name: 'Pendientes', value: dist['PENDIENTE'] || 0, color: '#eab308' },
        { name: 'Activos', value: dist['ACTIVO'] || 0, color: '#3b82f6' },
        { name: 'Devueltos', value: dist['DEVUELTO'] || 0, color: '#22c55e' },
        { name: 'Atrasados', value: dist['ATRASADO'] || 0, color: '#ef4444' },
      ].filter((item) => item.value > 0);
    }

    const pending = loans.filter((l) => l.status === 'pending' || l.backendStatus === 'PENDIENTE').length;
    const active = loans.filter((l) => l.status === 'approved' || l.backendStatus === 'ACTIVO').length;
    const returned = loans.filter((l) => l.status === 'returned' || l.backendStatus === 'DEVUELTO').length;
    const late = loans.filter((l) => l.backendStatus === 'ATRASADO').length;

    return [
      { name: 'Pendientes', value: pending, color: '#eab308' },
      { name: 'Activos', value: active, color: '#3b82f6' },
      { name: 'Devueltos', value: returned, color: '#22c55e' },
      { name: 'Atrasados', value: late, color: '#ef4444' },
    ].filter((item) => item.value > 0);
  }, [stats, loans]);

  // 3. Atrasos por Carrera
  const atrasosCarreraData = useMemo(() => {
    if (stats?.atrasos_por_carrera && stats.atrasos_por_carrera.length > 0) {
      return stats.atrasos_por_carrera.slice(0, 5).map((item) => ({
        carrera: item.carrera,
        Atrasos: item.total,
      }));
    }

    const counts: Record<string, number> = {};
    loans
      .filter((l) => l.backendStatus === 'ATRASADO' && l.studentCareer)
      .forEach((l) => {
        const c = l.studentCareer!;
        counts[c] = (counts[c] || 0) + 1;
      });

    return Object.entries(counts)
      .map(([carrera, total]) => ({ carrera, Atrasos: total }))
      .sort((a, b) => b.Atrasos - a.Atrasos)
      .slice(0, 5);
  }, [stats, loans]);

  // 4. Préstamos por Mes (Histórico)
  const prestamosMesData = useMemo(() => {
    if (stats?.prestamos_por_mes && stats.prestamos_por_mes.length > 0) {
      return stats.prestamos_por_mes.map((item) => ({
        mes: item.mes,
        Préstamos: item.total,
      }));
    }
    return [];
  }, [stats]);

  return (
    <div className="space-y-6 mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Equipos Populares */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Equipos Más Populares</CardTitle>
            <CardDescription>Top equipos más solicitados históricamente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              {topEquipmentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topEquipmentData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="Solicitudes" fill="#166534" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No hay datos suficientes
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 2: Estados */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Estado General de Préstamos</CardTitle>
            <CardDescription>Proporción de tickets por su estado actual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No hay datos suficientes
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos 3 y 4: Analítica de Atrasos por Carrera y Evolución Mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 3: Atrasos por Carrera */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Atrasos por Carrera</CardTitle>
            <CardDescription>Distribución de devoluciones tardías por facultad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              {atrasosCarreraData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={atrasosCarreraData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="carrera" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="Atrasos" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Sin registros de atrasos por carrera
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 4: Préstamos por Mes */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Uso Histórico por Mes</CardTitle>
            <CardDescription>Volumen de solicitudes procesadas en los últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              {prestamosMesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={prestamosMesData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="Préstamos" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {loans.length > 0 ? 'Generando datos mensuales...' : 'Sin registros de préstamos en el periodo'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
