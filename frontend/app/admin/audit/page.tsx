'use client';

import React, { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { fetchAuditLogs, AuditLog } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, Package, FileText, AlertTriangle, History, 
  Search, ShieldCheck, UserCheck, Activity, Calendar
} from 'lucide-react';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const reloadLogs = async () => {
    try {
      setErrorMsg(null);
      const data = await fetchAuditLogs();
      setLogs(data);
    } catch (err: unknown) {
      setLogs([]);
      setErrorMsg(err instanceof Error ? err.message : 'No se pudieron cargar los registros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadLogs();
  }, []);

  useAutoRefresh(reloadLogs, 10_000);

  const navItems = [
    { label: 'Dashboard',  href: '/admin',           icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Equipos',    href: '/admin/equipment',  icon: <Package className="w-4 h-4" /> },
    { label: 'Préstamos',  href: '/admin/loans',      icon: <FileText className="w-4 h-4" /> },
    { label: 'Sanciones',  href: '/admin/sanctions',  icon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'Auditoría',  href: '/admin/audit',      icon: <History className="w-4 h-4" /> },
  ];

  const getActionBadge = (accion: string, display: string) => {
    switch (accion) {
      case 'APROBAR_PRESTAMO':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">🟢 {display}</Badge>;
      case 'RECIBIR_PRESTAMO':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">🔵 {display}</Badge>;
      case 'RECHAZAR_PRESTAMO':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">🔴 {display}</Badge>;
      case 'CREAR_EQUIPO':
      case 'EDITAR_EQUIPO':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">📦 {display}</Badge>;
      case 'ELIMINAR_EQUIPO':
        return <Badge className="bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300">🗑️ {display}</Badge>;
      case 'CREAR_SANCION':
      case 'RESOLVER_SANCION':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">⚠️ {display}</Badge>;
      default:
        return <Badge variant="outline">{display}</Badge>;
    }
  };

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== 'all' && log.accion !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUser = log.usuario_nombre.toLowerCase().includes(q);
      const matchDesc = log.descripcion.toLowerCase().includes(q);
      const matchIp   = (log.ip_address || '').toLowerCase().includes(q);
      if (!matchUser && !matchDesc && !matchIp) return false;
    }
    return true;
  });

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <AppHeader title="Bitácora de Auditoría" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* Encabezado */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-7 h-7 text-green-600" />
                Bitácora de Movimientos
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Historial completo de acciones administrativas y eventos del sistema MOSQ
              </p>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground">
              <Activity className="w-4 h-4 text-green-500 animate-pulse" />
              Auto-actualizable (10s)
            </div>
          </div>

          {/* Filtros */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Buscador */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar por usuario, descripción o IP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Filtro Tipo de Acción */}
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">Todas las acciones ({logs.length})</option>
                  <option value="APROBAR_PRESTAMO">Préstamos Aprobados</option>
                  <option value="RECIBIR_PRESTAMO">Préstamos Recibidos</option>
                  <option value="RECHAZAR_PRESTAMO">Préstamos Rechazados</option>
                  <option value="CREAR_EQUIPO">Equipos Creados</option>
                  <option value="EDITAR_EQUIPO">Equipos Editados / Mantenimiento</option>
                  <option value="ELIMINAR_EQUIPO">Equipos Eliminados</option>
                  <option value="CREAR_SANCION">Sanciones Creadas</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between text-sm text-red-700 dark:text-red-300">
              <span>⚠️ {errorMsg}</span>
              <button
                onClick={reloadLogs}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Tabla / Tarjetas de Auditoría */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Cargando registros de bitácora...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Fecha y Hora</th>
                      <th className="px-4 py-3">Usuario Responsable</th>
                      <th className="px-4 py-3">Acción</th>
                      <th className="px-4 py-3">Detalle / Descripción</th>
                      <th className="px-4 py-3">Dirección IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-xs">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            {new Date(log.fecha_hora).toLocaleString('es-NI')}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                          <span className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 shrink-0 text-green-600" />
                            {log.usuario_nombre}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getActionBadge(log.accion, log.accion_display)}
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium max-w-md">
                          {log.descripcion}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono text-xs">
                          {log.ip_address || '127.0.0.1'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <History className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-foreground font-semibold">No se encontraron registros de auditoría</p>
                <p className="text-sm text-muted-foreground mt-1">Los movimientos administrativos aparecerán aquí automáticamente.</p>
              </CardContent>
            </Card>
          )}

        </div>
      </main>
    </ProtectedLayout>
  );
}
