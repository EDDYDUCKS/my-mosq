'use client';

import React, { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { fetchAdminLoans, markLoanAsReturned, updateLoanStatus } from '@/lib/api-client';
import { LoanRequest } from '@/lib/types';
import { useNotifications } from '@/lib/notifications-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Package,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// Grupo de préstamos que comparten el mismo loanGroupId (mismo ticket del backend)
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
  representative: LoanRequest; // un item para acciones
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
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [workingGroupId, setWorkingGroupId] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await fetchAdminLoans();
        if (isMounted) setLoans(data);
      } catch {
        if (isMounted) setLoans([]);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const reload = async () => {
    const data = await fetchAdminLoans();
    setLoans(data);
  };

  const handleApprove = async (group: LoanGroup) => {
    setWorkingGroupId(group.groupId);
    try {
      await updateLoanStatus(group.groupId, 'ACTIVO');
      await reload();
      addNotification('Préstamo entregado', 'Se registró el encargado que entregó el equipo.', 'success');
    } finally { setWorkingGroupId(null); }
  };

  const handleReject = async (group: LoanGroup) => {
    setWorkingGroupId(group.groupId);
    try {
      await updateLoanStatus(group.groupId, 'RECHAZADO');
      await reload();
    } finally { setWorkingGroupId(null); }
  };

  const handleMarkReturned = async (group: LoanGroup) => {
    setWorkingGroupId(group.groupId);
    try {
      await markLoanAsReturned(group.groupId);
      await reload();
      addNotification('Recepción registrada', 'Se guardó el encargado que recibió el equipo de vuelta.', 'success');
    } finally { setWorkingGroupId(null); }
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
    { label: 'Dashboard', href: '/admin', icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Equipos', href: '/admin/equipment', icon: <Package className="w-4 h-4" /> },
    { label: 'Préstamos', href: '/admin/loans', icon: <FileText className="w-4 h-4" /> },
    { label: 'Sanciones', href: '/admin/sanctions', icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  const allGroups = groupLoans(loans);
  const activeGroups = allGroups.filter(g => g.status === 'pending' || g.status === 'approved');
  const closedGroups = allGroups.filter(g => g.status === 'returned' || g.status === 'rejected');

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
          {/* Lista de equipos */}
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

          {/* Fechas */}
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
              <p className="text-sm text-foreground">
                {new Date(group.receivedAt).toLocaleString('es-NI')}
              </p>
            </div>
          )}

          {/* Acciones */}
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
                    {working ? 'Actualizando...' : 'Aceptar'}
                  </Button>
                  <Button
                    onClick={() => handleReject(group)}
                    variant="outline"
                    className="flex-1 border-red-600 text-red-600 hover:bg-red-600 hover:text-white gap-2"
                    disabled={working}
                  >
                    <XCircle className="w-4 h-4" />
                    {working ? 'Actualizando...' : 'Denegar'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => handleMarkReturned(group)}
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
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground">Préstamos</h2>
            <p className="text-muted-foreground">Gestiona las solicitudes de préstamo</p>
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
    </ProtectedLayout>
  );
}
