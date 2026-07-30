'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { ReportsDownload } from '@/components/reports-download';
import { fetchAdminLoans, fetchEquipment, procesarAtrasadosApi } from '@/lib/api-client';
import { Equipment, LoanRequest } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Package,
  FileText,
  AlertTriangle,
  Download,
  X,
} from 'lucide-react';
import { DashboardCharts } from '@/components/dashboard-charts';
import { useNotifications } from '@/lib/notifications-context';

const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export default function AdminDashboard() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [lastPendingCount, setLastPendingCount] = useState<number>(0);
  const [showMonthlyAlert, setShowMonthlyAlert] = useState(false);
  const [prevMonthLabel, setPrevMonthLabel] = useState('');

  useEffect(() => {
    let isMounted = true;
    let syncInterval: NodeJS.Timeout;

    const loadData = async (isSilent = false) => {
      try {
        // Disparador silencioso: Procesa sanciones automáticas por atrasos (solo al inicio)
        if (!isSilent) {
          try {
            await procesarAtrasadosApi();
          } catch (e) {
            console.error('Error procesando atrasados:', e);
          }
        }

        const [equipmentData, loansData] = await Promise.all([
          fetchEquipment(),
          fetchAdminLoans(),
        ]);

        if (!isMounted) return;
        setEquipment(equipmentData);
        setLoans(loansData);
        
        // Live Sync: Detectar nuevas solicitudes pendientes
        const currentPending = loansData.filter(l => l.status === 'pending').length;
        setLastPendingCount(currentPending);
        
      } catch {
        if (!isMounted) return;
        if (!isSilent) {
          setEquipment([]);
          setLoans([]);
        }
      }
    };

    loadData();

    // ── Alerta mensual: detectar si es un mes nuevo ──────────────────────
    if (typeof window !== 'undefined') {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lastSaved = localStorage.getItem('mosq_last_report_month');
      if (lastSaved !== currentMonthKey) {
        // Calcular mes anterior
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const label = `${MESES_ES[prevDate.getMonth()]} ${prevDate.getFullYear()}`;
        setPrevMonthLabel(label);
        setShowMonthlyAlert(true);
      }
    }

    // Solicitar permisos para notificaciones nativas de escritorio al cargar el dashboard
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Sincronización en vivo cada 10 segundos
    syncInterval = setInterval(() => {
      loadData(true);
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
    };
  }, []);

  const totalRequests = loans.length;
  const pendingRequests = loans.filter((r) => r.status === 'pending').length;
  const totalEquipment = equipment.reduce((sum, eq) => sum + eq.total, 0);
  const availableEquipment = equipment.reduce((sum, eq) => sum + eq.available, 0);
  const categoriesCount = useMemo(() => new Set(equipment.map((item) => item.category)).size, [equipment]);

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Equipos', href: '/admin/equipment', icon: <Package className="w-4 h-4" /> },
    { label: 'Préstamos', href: '/admin/loans', icon: <FileText className="w-4 h-4" /> },
    { label: 'Sanciones', href: '/admin/sanctions', icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  const dismissMonthlyAlert = () => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem('mosq_last_report_month', key);
    setShowMonthlyAlert(false);
  };

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <AppHeader title="Panel Administrativo" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">

        {/* ── Banner de recordatorio mensual ── */}
        {showMonthlyAlert && (
          <div className="lg:pl-0 sticky top-0 z-40">
            <div className="bg-amber-50 dark:bg-amber-950 border-b-2 border-amber-300 dark:border-amber-700 px-4 py-3">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📊</span>
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100 text-sm">
                      Recordatorio: Descarga el reporte de {prevMonthLabel}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Es inicio de mes — el reporte mensual anterior está listo para descargar.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs"
                    onClick={() => {
                      dismissMonthlyAlert();
                      // Scroll al componente de reportes
                      document.getElementById('reports-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Ir a Descargar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 text-xs gap-1"
                    onClick={dismissMonthlyAlert}
                  >
                    <X className="w-3.5 h-3.5" />
                    Recordar después
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Resumen</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Vista general del sistema de préstamos
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <Card className="border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-slate-950 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-300">
                  Total Equipos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{totalEquipment}</p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                  {availableEquipment} disponibles
                </p>
              </CardContent>
            </Card>

            <Card className="border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-slate-950 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-300">
                  Total Solicitudes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{totalRequests}</p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                  {pendingRequests} pendientes
                </p>
              </CardContent>
            </Card>

            <Card className="border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-slate-950 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-300">
                  Categorías
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {categoriesCount}
                </p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                  tipos de equipos
                </p>
              </CardContent>
            </Card>

            <Card className="border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-slate-950 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-300">
                  Tasa Disponibilidad
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {totalEquipment > 0 ? Math.round((availableEquipment / totalEquipment) * 100) : 0}%
                </p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                  equipos disponibles
                </p>
              </CardContent>
            </Card>
          </div>

          <DashboardCharts loans={loans} equipment={equipment} />

          {/* Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Requests */}
            <Card>
              <CardHeader>
                <CardTitle>Solicitudes Recientes</CardTitle>
                <CardDescription>
                  Últimas solicitudes de préstamo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loans.slice(0, 3).map((request) => (
                    <div key={request.id} className="flex items-center justify-between pb-4 border-b border-border last:border-0">
                      <div>
                        <p className="font-semibold text-sm text-foreground">
                          {request.equipmentName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.studentName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-foreground">
                          Qty: {request.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.requestDate).toLocaleDateString('es-NI')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Equipment Status */}
            <Card>
              <CardHeader>
                <CardTitle>Estado de Equipos</CardTitle>
                <CardDescription>
                  Equipos por disponibilidad
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {equipment.slice(0, 3).map((eq) => {
                    const percentage = (eq.available / eq.total) * 100;
                    return (
                      <div key={eq.id}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-foreground">
                            {eq.name}
                          </p>
                          <p className="text-xs font-semibold text-muted-foreground">
                            {eq.available}/{eq.total}
                          </p>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percentage > 50
                                ? 'bg-green-500'
                                : percentage > 25
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.max(percentage, 5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reports Section */}
          <div id="reports-section" className="mt-8">
            <ReportsDownload />
          </div>
        </div>
      </main>
    </ProtectedLayout>
  );
}
