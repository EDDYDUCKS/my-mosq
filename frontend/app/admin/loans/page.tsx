'use client';

import React, { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { fetchAdminLoans, markLoanAsReturned, updateLoanStatus, createSanction } from '@/lib/api-client';
import { LoanRequest } from '@/lib/types';
import { useNotifications } from '@/lib/notifications-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QrScanner } from '@/components/qr-scanner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  BarChart3, Package, FileText, AlertTriangle,
  CheckCircle, XCircle, QrCode, Plus, Clock, CalendarClock, Search, History
} from 'lucide-react';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { SpecialLoanDialog } from '@/components/special-loan-dialog';

interface LoanGroup {
  groupId: string;
  studentName: string;
  studentId: string;
  status: LoanRequest['status'];
  backendStatus?: string;
  requestDate: Date;
  dueDate: Date;
  deliveredByName?: string;
  receivedByName?: string;
  receivedAt?: Date;
  items: { equipmentName: string; quantity: number }[];
  representative: LoanRequest;
}

function groupLoans(loans: LoanRequest[]): LoanGroup[] {
  const map = new Map<string, LoanGroup>();
  for (const loan of loans) {
    const key = loan.loanGroupId ?? loan.id;
    if (!map.has(key)) {
      map.set(key, {
        groupId: key,
        studentName: loan.studentName,
        studentId: loan.studentId,
        status: loan.status,
        backendStatus: loan.backendStatus,
        requestDate: loan.requestDate,
        dueDate: loan.dueDate,
        deliveredByName: loan.deliveredByName,
        receivedByName: loan.receivedByName,
        receivedAt: loan.receivedAt,
        items: [],
        representative: loan,
      });
    }
    map.get(key)!.items.push({ equipmentName: loan.equipmentName, quantity: loan.quantity });
  }
  return Array.from(map.values());
}

/** Formatea una fecha usando hora LOCAL del navegador (evita bug UTC-6 Nicaragua) */
function formatDateTime(date: Date, includeTime = true): string {
  return date.toLocaleString('es-NI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export default function AdminLoansPage() {
  const [loans, setLoans]                   = useState<LoanRequest[]>([]);
  const [workingGroupId, setWorkingGroupId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [specialLoanOpen, setSpecialLoanOpen] = useState(false);
  const [rejectTarget, setRejectTarget]     = useState<LoanGroup | null>(null);
  const [rejectReason, setRejectReason]     = useState('');
  const [rejecting, setRejecting]           = useState(false);

  // Estados para la devolución con sanción
  const [returnTarget, setReturnTarget] = useState<{ groupId: string, studentId?: string } | null>(null);
  const [applySanction, setApplySanction] = useState(false);
  const [sanctionReason, setSanctionReason] = useState('');
  const [sanctionSeverity, setSanctionSeverity] = useState<'warning' | 'restriction' | 'ban'>('warning');

  // Estados de filtro por estado y búsqueda
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'overdue' | 'returned' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { addNotification } = useNotifications();

  const reload = async () => {
    const data = await fetchAdminLoans();
    setLoans(data);
  };

  // Auto-refresco cada 8 segundos
  useAutoRefresh(reload, 8_000);

  const handleApprove = async (group: LoanGroup) => {
    setWorkingGroupId(group.groupId);
    try {
      await updateLoanStatus(group.groupId, 'ACTIVO');
      await reload();
      addNotification('Préstamo aprobado', 'El equipo fue marcado como entregado.', 'success');
    } finally { setWorkingGroupId(null); }
  };

  const openRejectDialog = (group: LoanGroup) => {
    setRejectTarget(group);
    setRejectReason('');
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await updateLoanStatus(rejectTarget.groupId, 'RECHAZADO', rejectReason.trim() || undefined);
      await reload();
      setRejectTarget(null);
    } finally {
      setRejecting(false);
    }
  };

  const initiateReturn = (groupId: string, studentId?: string) => {
    setReturnTarget({ groupId, studentId });
    setApplySanction(false);
    setSanctionReason('');
    setSanctionSeverity('warning');
    setScannerOpen(false); // Por si viene del escáner
  };

  const confirmReturn = async () => {
    if (!returnTarget) return;
    setWorkingGroupId(returnTarget.groupId);
    try {
      await markLoanAsReturned(returnTarget.groupId);
      
      if (applySanction && sanctionReason && returnTarget.studentId) {
        await createSanction({
          studentId: returnTarget.studentId,
          reason: sanctionReason,
          severity: sanctionSeverity,
        });
        addNotification('Devolución y Sanción', 'Equipo recibido y estudiante sancionado.', 'warning');
      } else {
        addNotification('Devolución registrada', 'El equipo fue recibido de vuelta.', 'success');
      }
      
      await reload();
      setReturnTarget(null);
    } finally { 
      setWorkingGroupId(null); 
    }
  };

  const statusColor = (status: LoanRequest['status']) => {
    switch (status) {
      case 'pending':  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'returned': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:         return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const statusLabel = (status: LoanRequest['status']) => {
    switch (status) {
      case 'pending':  return 'Pendiente';
      case 'approved': return 'Activo';
      case 'returned': return 'Devuelto';
      case 'rejected': return 'Rechazado';
      default:         return status;
    }
  };

  const navItems = [
    { label: 'Dashboard',  href: '/admin',           icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Equipos',    href: '/admin/equipment',  icon: <Package className="w-4 h-4" /> },
    { label: 'Préstamos',  href: '/admin/loans',      icon: <FileText className="w-4 h-4" /> },
    { label: 'Sanciones',  href: '/admin/sanctions',  icon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'Auditoría',  href: '/admin/audit',      icon: <History className="w-4 h-4" /> },
  ];

  const allGroups = groupLoans(loans);
  const sortByDate = (a: LoanGroup, b: LoanGroup) =>
    new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();

  // Contadores por estado
  const countAll = allGroups.length;
  const countPending = allGroups.filter(g => g.status === 'pending').length;
  const countApproved = allGroups.filter(g => {
    const due = new Date(g.dueDate);
    due.setHours(23, 59, 59, 999);
    const isOverdue = g.backendStatus === 'ATRASADO' || (g.status === 'approved' && (due.getTime() - new Date().getTime()) < 0);
    return g.status === 'approved' && !isOverdue;
  }).length;
  const countOverdue = allGroups.filter(g => {
    const due = new Date(g.dueDate);
    due.setHours(23, 59, 59, 999);
    return g.backendStatus === 'ATRASADO' || (g.status === 'approved' && (due.getTime() - new Date().getTime()) < 0);
  }).length;
  const countReturned = allGroups.filter(g => g.status === 'returned').length;
  const countRejected = allGroups.filter(g => g.status === 'rejected').length;

  const filteredGroups = allGroups.filter(g => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = g.studentName.toLowerCase().includes(q);
      const matchItems = g.items.some(i => i.equipmentName.toLowerCase().includes(q));
      const matchTicket = g.groupId.includes(q);
      if (!matchName && !matchItems && !matchTicket) return false;
    }

    const due = new Date(g.dueDate);
    due.setHours(23, 59, 59, 999);
    const isOverdue = g.backendStatus === 'ATRASADO' || (g.status === 'approved' && (due.getTime() - new Date().getTime()) < 0);

    if (statusFilter === 'pending') return g.status === 'pending';
    if (statusFilter === 'approved') return g.status === 'approved' && !isOverdue;
    if (statusFilter === 'overdue') return isOverdue;
    if (statusFilter === 'returned') return g.status === 'returned';
    if (statusFilter === 'rejected') return g.status === 'rejected';

    return true;
  }).sort(sortByDate);

  const renderGroup = (group: LoanGroup, closed = false) => {
    const working = workingGroupId === group.groupId;

    // Lógica de urgencia (solo relevante para préstamos activos)
    const now = new Date();
    const due = new Date(group.dueDate);
    due.setHours(23, 59, 59, 999); // fin del día
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isOverdue = group.backendStatus === 'ATRASADO' || (group.status === 'approved' && diffDays < 0);
    const isDueToday = group.status === 'approved' && diffDays === 0 && !isOverdue;

    // Estilos por estado (borde + cabecera + badge)
    type StyleKey = 'pending' | 'approved' | 'returned' | 'rejected';
    const statusStyles: Record<StyleKey, { card: string; header: string; badge: string }> = {
      pending:  { card: 'border-yellow-300 dark:border-yellow-700', header: 'bg-yellow-50 dark:bg-yellow-950/40', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      approved: isOverdue
        ? { card: 'border-red-400 dark:border-red-700',    header: 'bg-red-50 dark:bg-red-950/30',      badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
        : { card: 'border-green-300 dark:border-green-700', header: 'bg-green-50 dark:bg-green-950/40',  badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      returned: { card: 'border-blue-200 dark:border-blue-800',    header: 'bg-blue-50/50 dark:bg-blue-950/20',  badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      rejected: { card: 'border-border',                            header: 'bg-muted/30',                        badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    };
    const styles = statusStyles[group.status as StyleKey] ?? statusStyles.rejected;

    return (
      <Card key={group.groupId} className={`overflow-hidden border-2 ${styles.card} transition-shadow hover:shadow-md`}>

        {/* ── Cabecera coloreada por estado ── */}
        <div className={`px-4 py-3 ${styles.header} border-b border-border`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium mb-0.5">Solicitud #{group.groupId}</p>
              <p className="font-bold text-foreground text-base leading-tight truncate">{group.studentName}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                Solicitado: {formatDateTime(group.requestDate)}
              </p>
            </div>
            <Badge className={`${styles.badge} shrink-0 text-xs font-semibold`}>
              {statusLabel(group.status)}
            </Badge>
          </div>
        </div>

        <CardContent className="p-4 space-y-4">

          {/* ── Lista de equipos ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
              <Package className="w-3 h-3" /> Equipos solicitados
            </p>
            <ul className="divide-y divide-border rounded-lg border bg-muted/20">
              {group.items.map((item, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-foreground font-medium">{item.equipmentName}</span>
                  <span className="text-muted-foreground font-mono">×{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Fecha límite con indicador de urgencia ── */}
          <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${
            isOverdue  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
            isDueToday ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' :
                         'bg-muted/40 border-border'
          }`}>
            <div className="flex items-center gap-2">
              <CalendarClock className={`w-4 h-4 shrink-0 ${
                isOverdue ? 'text-red-500' : isDueToday ? 'text-orange-500' : 'text-muted-foreground'
              }`} />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Devolver antes del</p>
                <p className={`text-sm font-semibold ${
                  isOverdue ? 'text-red-600 dark:text-red-400' :
                  isDueToday ? 'text-orange-600 dark:text-orange-400' :
                  'text-foreground'
                }`}>
                  {formatDateTime(group.dueDate, false)}
                </p>
              </div>
            </div>
            {isOverdue  && <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/60 px-2 py-0.5 rounded-full">🔴 VENCIDO</span>}
            {isDueToday && <span className="text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/60 px-2 py-0.5 rounded-full">⚠️ HOY</span>}
          </div>

          {/* ── Entregado / Recibido — solo si tienen valor ── */}
          {(group.deliveredByName || group.receivedByName || group.receivedAt) && (
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
              {group.deliveredByName && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Entregado por</p>
                  <p className="text-sm text-foreground">{group.deliveredByName}</p>
                </div>
              )}
              {group.receivedByName && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Recibido por</p>
                  <p className="text-sm text-foreground">{group.receivedByName}</p>
                </div>
              )}
              {group.receivedAt && (
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Recibido el</p>
                  <p className="text-sm text-foreground">{formatDateTime(group.receivedAt)}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Notas ── */}
          {group.representative?.notes && (
            <div className="bg-muted/50 rounded-lg px-3 py-2 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Observaciones</p>
              <p className="text-sm text-foreground">{group.representative.notes}</p>
            </div>
          )}

          {/* ── Botones de acción ── */}
          {!closed && (
            <div className="flex gap-2 pt-1">
              {group.status === 'pending' ? (
                <>
                  <Button
                    onClick={() => handleApprove(group)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                    disabled={working}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {working ? 'Actualizando...' : 'Aprobar'}
                  </Button>
                  <Button
                    onClick={() => openRejectDialog(group)}
                    variant="outline"
                    className="flex-1 border-red-500 text-red-600 hover:bg-red-600 hover:text-white gap-2"
                    disabled={working}
                  >
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => initiateReturn(group.groupId, group.studentId)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  disabled={working}
                >
                  <CheckCircle className="w-4 h-4" />
                  {working ? 'Actualizando...' : 'Marcar Devuelto'}
                </Button>
              )}
            </div>
          )}

        </CardContent>
      </Card>
    );
  };

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <AppHeader title="Gestión de Préstamos" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Préstamos</h2>
              <p className="text-sm sm:text-base text-muted-foreground">Gestiona las solicitudes de préstamo</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setSpecialLoanOpen(true)}
                variant="outline"
                className="gap-2"
              >
                <Plus className="w-4 h-4" /> Préstamo Especial
              </Button>
              <Button
                onClick={() => setScannerOpen(true)}
                className="bg-green-700 hover:bg-green-800 text-white gap-2"
              >
                <QrCode className="w-4 h-4" /> Escanear QR 📷
              </Button>
            </div>
          </div>

          {/* ── Barra de búsqueda y Pestañas de Filtro por Estado ── */}
          <div className="mb-6 space-y-4">
            {/* Buscador */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por estudiante, equipo o N° de ticket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Pestañas de Estado */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-foreground text-background font-bold shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                Todos <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-background/20">{countAll}</span>
              </button>

              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-500 text-white font-bold shadow-sm'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 hover:bg-yellow-200'
                }`}
              >
                🟡 Pendientes <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{countPending}</span>
              </button>

              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'approved'
                    ? 'bg-green-600 text-white font-bold shadow-sm'
                    : 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 hover:bg-green-200'
                }`}
              >
                🟢 Activos <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{countApproved}</span>
              </button>

              <button
                onClick={() => setStatusFilter('overdue')}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'overdue'
                    ? 'bg-red-600 text-white font-bold shadow-sm'
                    : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 hover:bg-red-200'
                }`}
              >
                🔴 Atrasados <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{countOverdue}</span>
              </button>

              <button
                onClick={() => setStatusFilter('returned')}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'returned'
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-200'
                }`}
              >
                🔵 Devueltos <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{countReturned}</span>
              </button>

              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'rejected'
                    ? 'bg-gray-700 text-white font-bold shadow-sm'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                ⚪ Rechazados <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{countRejected}</span>
              </button>
            </div>
          </div>

          {filteredGroups.length > 0 ? (
            <div className="grid gap-4">
              {filteredGroups.map(g => renderGroup(g, g.status === 'returned' || g.status === 'rejected'))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-muted-foreground">No hay préstamos que coincidan con el filtro seleccionado</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* ── MODAL: Escáner QR ── */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-green-600" /> Escáner QR
            </DialogTitle>
            <DialogDescription>
              Apunta la cámara al código QR del estudiante para aprobar o registrar una devolución.
            </DialogDescription>
          </DialogHeader>
          <QrScanner 
            onReturnScanned={(loanId) => {
              // Buscar el studentId del préstamo escaneado para la posible sanción
              const loan = allGroups.find(g => g.groupId === loanId);
              initiateReturn(loanId, loan?.studentId);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Rechazar con motivo ── */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" /> Rechazar Solicitud #{rejectTarget?.groupId}
            </DialogTitle>
            <DialogDescription>
              Puedes escribir el motivo del rechazo. Si lo dejas vacío, el estudiante solo verá &quot;Solicitud rechazada&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Motivo del rechazo (opcional)…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejecting}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmReject}
              disabled={rejecting}
            >
              {rejecting ? 'Rechazando...' : 'Confirmar Rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Confirmar Devolución (con opción a sanción) ── */}
      <Dialog open={!!returnTarget} onOpenChange={(open) => { if (!open) setReturnTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <CheckCircle className="w-5 h-5" /> Confirmar Devolución
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de marcar el ticket #{returnTarget?.groupId} como devuelto?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 border-t border-border mt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="apply-sanction" className="text-base font-semibold">Aplicar Sanción</Label>
                <p className="text-xs text-muted-foreground">Si el equipo fue dañado o devuelto tarde</p>
              </div>
              <Switch
                id="apply-sanction"
                checked={applySanction}
                onCheckedChange={setApplySanction}
              />
            </div>

            {applySanction && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <Label htmlFor="sanction-reason">Motivo de la Sanción</Label>
                  <Textarea
                    id="sanction-reason"
                    placeholder="Ej: Balón ponchado, entrega 2 días tarde..."
                    value={sanctionReason}
                    onChange={(e) => setSanctionReason(e.target.value)}
                    className="border-input resize-none"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sanction-severity">Severidad</Label>
                  <select
                    id="sanction-severity"
                    value={sanctionSeverity}
                    onChange={(e) => setSanctionSeverity(e.target.value as 'warning' | 'restriction' | 'ban')}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                  >
                    <option value="warning">Advertencia</option>
                    <option value="restriction">Restricción Temporal</option>
                    <option value="ban">Prohibición Permanente</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReturnTarget(null)} disabled={workingGroupId === returnTarget?.groupId}>
              Cancelar
            </Button>
            <Button
              className={applySanction ? "bg-red-600 hover:bg-red-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
              onClick={confirmReturn}
              disabled={workingGroupId === returnTarget?.groupId || (applySanction && !sanctionReason.trim())}
            >
              {workingGroupId === returnTarget?.groupId ? 'Procesando...' : (applySanction ? 'Devolver y Sancionar' : 'Confirmar Devolución')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SpecialLoanDialog 
        open={specialLoanOpen} 
        onOpenChange={setSpecialLoanOpen}
        onSuccess={() => {
          addNotification('Préstamo Especial Creado', 'El préstamo activo ha sido creado con éxito.', 'success');
          reload();
        }}
      />

    </ProtectedLayout>
  );
}
