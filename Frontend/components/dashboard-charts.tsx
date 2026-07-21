'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoanRequest, Equipment } from '@/lib/types';
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
  Legend
} from 'recharts';

interface DashboardChartsProps {
  loans: LoanRequest[];
  equipment: Equipment[];
}

export function DashboardCharts({ loans }: DashboardChartsProps) {
  // 1. Calcular Top Equipos más solicitados
  const topEquipmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    loans.forEach(loan => {
      const name = loan.equipmentName || 'Desconocido';
      counts[name] = (counts[name] || 0) + loan.quantity;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, Solicitudes: count }))
      .sort((a, b) => b.Solicitudes - a.Solicitudes)
      .slice(0, 5); // Top 5
  }, [loans]);

  // 2. Calcular Estado de Préstamos (Pie Chart)
  const statusData = useMemo(() => {
    const pending = loans.filter(l => l.status === 'pending' || l.backendStatus === 'PENDIENTE').length;
    const active = loans.filter(l => l.status === 'approved' || l.backendStatus === 'ACTIVO').length;
    const returned = loans.filter(l => l.status === 'returned' || l.backendStatus === 'DEVUELTO').length;
    const late = loans.filter(l => l.backendStatus === 'ATRASADO').length;

    return [
      { name: 'Pendientes', value: pending, color: '#eab308' }, // yellow-500
      { name: 'Activos', value: active, color: '#3b82f6' }, // blue-500
      { name: 'Devueltos', value: returned, color: '#22c55e' }, // green-500
      { name: 'Atrasados', value: late, color: '#ef4444' }, // red-500
    ].filter(item => item.value > 0);
  }, [loans]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Gráfico de Barras: Equipos Populares */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Equipos Más Populares</CardTitle>
          <CardDescription>Top 5 equipos más solicitados históricamente</CardDescription>
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

      {/* Gráfico de Pastel: Estados */}
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
  );
}
