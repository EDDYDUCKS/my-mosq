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
  CheckCircle, XCircle, QrCode, Plus,
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
  ];

  const allGroups    = groupLoans(loans);
  const sortByDate   = (a: LoanGroup, b: LoanGroup) =>
    new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
  const activeGroups = allGroups.filter(g => g.status === 'pending' || g.status === 'approved').sort(sortByDate);
  const closedGroups = allGroups.filter(g => g.status === 'returned' || g.status === 'rejected').sort(sortByDate);

  const renderGroup = (group: LoanGroup, closed = false) => {
    const working = workingGroupId === group.groupId;
    return (
      <Card key={group.groupId} className={!closed ? 'border-yellow-200 dark:border-yellow-800' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg">Solicitud #{group.groupId}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Solicitante: <span className="font-medium text-foreground">{group.studentName}</span>
              </p>
            </div>
            <Badge className={statusColor(group.status)}>{statusLabel(group.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Equipos solicitados</p>
            <ul className="divide-y divide-border rounded-lg border">
              {group.items.map((item, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-foreground font-medium">{item.equipmentName}</span>
                  <span className="text-muted-foreground">×{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Fecha Solicitud</p>
              <p className="text-sm text-foreground">{new Date(group.requestDate).toLocaleDateString('es-NI')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Fecha Límite</p>
              <p className="text-sm text-foreground">{new Date(group.dueDate).toLocaleDateString('es-NI')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Entregado por</p>
              <p className="text-sm text-foreground">{group.deliveredByName || 'Pendiente'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Recibido por</p>
              <p className="text-sm text-foreground">{group.receivedByName || 'Pendiente'}</p>
            </div>
          </div>

          {group.receivedAt && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Fecha de recepción</p>
              <p className="text-sm text-foreground">{new Date(group.receivedAt).toLocaleString('es-NI')}</p>
            </div>
          )}

          {group.representative?.notes && (
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas / Observaciones</p>
              <p className="text-sm text-foreground">{group.representative.notes}</p>
            </div>
          )}

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
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
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

          {activeGroups.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Solicitudes Activas ({activeGroups.length})
              </h3>
              <div className="grid gap-4">
                {activeGroups.map(g => renderGroup(g))}
              </div>
            </div>
          )}

          {closedGroups.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Histórico ({closedGroups.length})
              </h3>
              <div className="grid gap-4">
                {closedGroups.map(g => renderGroup(g, true))}
              </div>
            </div>
          )}

          {allGroups.length === 0 && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-muted-foreground">No hay solicitudes de préstamo</p>
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
