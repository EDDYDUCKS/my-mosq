'use client';

import React, { useCallback, useState } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { fetchStudentLoans } from '@/lib/api-client';
import { LoanRequest } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, FileCheck, ShoppingCart, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReturnQrModal } from '@/components/return-qr-modal';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

interface LoanGroup {
  groupId: string;
  status: LoanRequest['status'];
  requestDate: Date;
  dueDate: Date;
  studentName: string;
  notes?: string;
  items: { equipmentName: string; quantity: number }[];
}

function groupLoans(loans: LoanRequest[]): LoanGroup[] {
  const map = new Map<string, LoanGroup>();

  for (const loan of loans) {
    const groupId = loan.loanGroupId ?? loan.id;

    if (!map.has(groupId)) {
      map.set(groupId, {
        groupId,
        status: loan.status,
        requestDate: loan.requestDate,
        dueDate: loan.dueDate,
        studentName: loan.studentName,
        notes: loan.notes,
        items: [],
      });
    }

    map.get(groupId)?.items.push({
      equipmentName: loan.equipmentName,
      quantity: loan.quantity,
    });
  }

  return Array.from(map.values());
}

export default function StudentLoansPage() {
  const [loans, setLoans]     = useState<LoanRequest[]>([]);
  const [returnModal, setReturnModal] = useState<{ id: string; items: string[] } | null>(null);

  const loadLoans = useCallback(async () => {
    try {
      const data = await fetchStudentLoans();
      setLoans(data);
    } catch {
      setLoans([]);
    }
  }, []);

  // Auto-refresco cada 8 segundos
  useAutoRefresh(loadLoans, 8_000);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'returned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusLabel = (status: LoanRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'rejected':
        return 'Rechazado';
      case 'returned':
        return 'Devuelto';
      default:
        return status;
    }
  };

  const navItems = [
    { label: 'Inicio',        href: '/dashboard',      icon: <Home className="w-4 h-4" /> },
    { label: 'Catálogo',      href: '/prestamos',       icon: <ShoppingCart className="w-4 h-4" /> },
    { label: 'Mis Préstamos', href: '/dashboard/loans', icon: <FileCheck className="w-4 h-4" /> },
  ];

  const STATUS_ORDER: Record<string, number> = {
    pending: 0, approved: 1, returned: 2, rejected: 3,
  };

  const groupedLoans = groupLoans(loans).sort((a, b) => {
    // Activos/pendientes primero, luego histórico
    const statusDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    // Dentro de cada grupo, más reciente primero
    return new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
  });

  return (
    <ProtectedLayout allowedRoles={['student']}>
      <AppHeader title="Mis Préstamos" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-mobile-nav">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-2xl font-bold text-foreground mb-2">Mis Préstamos</h2>
            <p className="text-sm text-muted-foreground">
              Gestiona todas tus solicitudes de préstamo
            </p>
          </div>

          <div className="space-y-4">
            {groupedLoans.map((request) => (
              <Card key={request.groupId} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">Solicitud #{request.groupId}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Solicitado: {new Date(request.requestDate).toLocaleDateString('es-NI')}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {getStatusLabel(request.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Equipos solicitados</p>
                    <ul className="divide-y divide-border rounded-lg border">
                      {request.items.map((item, index) => (
                        <li key={`${request.groupId}-${item.equipmentName}-${index}`} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-foreground font-medium">{item.equipmentName}</span>
                          <span className="text-muted-foreground">x{item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Equipos</p>
                      <p className="text-lg font-bold text-foreground">{request.items.length}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Fecha Solicitud</p>
                      <p className="text-sm text-foreground">
                        {new Date(request.requestDate).toLocaleDateString('es-NI')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Fecha Devolución</p>
                      <p className="text-sm text-foreground">
                        {new Date(request.dueDate).toLocaleDateString('es-NI')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Solicitante</p>
                      <p className="text-sm text-foreground">{request.studentName}</p>
                    </div>
                  </div>
                  {request.notes && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas</p>
                      <p className="text-sm text-foreground">{request.notes}</p>
                    </div>
                  )}
                  {/* Botón Devolver: solo para préstamos ACTIVOS o ATRASADOS */}
                  {(request.status === 'approved' || (request as { backendStatus?: string }).backendStatus === 'ATRASADO') && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-green-600 text-green-700 hover:bg-green-600 hover:text-white gap-2"
                        onClick={() => setReturnModal({
                          id: request.groupId,
                          items: request.items.map(i => i.equipmentName),
                        })}
                      >
                        <RotateCcw className="w-4 h-4" /> Devolver Equipo
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {groupedLoans.length === 0 && (
              <Card>
                <CardContent className="pt-8 pb-8 text-center">
                  <p className="text-muted-foreground mb-4">No tienes solicitudes de préstamo aún</p>
                  <a href="/prestamos" className="text-primary hover:underline text-sm font-semibold">
                    Ir al catálogo →
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
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
