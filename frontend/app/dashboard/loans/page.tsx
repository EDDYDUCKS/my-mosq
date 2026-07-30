'use client';

import React, { useCallback, useState } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { fetchStudentLoans } from '@/lib/api-client';
import { LoanRequest } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, FileCheck, ShoppingCart, RotateCcw, Clock, CalendarClock } from 'lucide-react';
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

/** Formatea una fecha con hora local (evita bug UTC-6 Nicaragua) */
function formatDateTime(date: Date, includeTime = true): string {
  return date.toLocaleString('es-NI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export default function StudentLoansPage() {
  const [loans, setLoans]     = useState<LoanRequest[]>([]);
  const [returnModal, setReturnModal] = useState<{ id: string; items: string[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'returned' | 'rejected'>('all');

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

  const allGrouped = groupLoans(loans);
  const countAll = allGrouped.length;
  const countPending = allGrouped.filter(g => g.status === 'pending').length;
  const countApproved = allGrouped.filter(g => g.status === 'approved').length;
  const countReturned = allGrouped.filter(g => g.status === 'returned').length;
  const countRejected = allGrouped.filter(g => g.status === 'rejected').length;

  const groupedLoans = allGrouped
    .filter(g => {
      if (statusFilter === 'all') return true;
      return g.status === statusFilter;
    })
    .sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
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

          {/* Pestañas de estado */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-4 scrollbar-none text-xs font-semibold">
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
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300'
              }`}
            >
              🟡 Pendientes <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{countPending}</span>
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'approved'
                  ? 'bg-green-600 text-white font-bold shadow-sm'
                  : 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300'
              }`}
            >
              🟢 Aprobados <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{countApproved}</span>
            </button>
            <button
              onClick={() => setStatusFilter('returned')}
              className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'returned'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
              }`}
            >
              🔵 Devueltos <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{countReturned}</span>
            </button>
            {countRejected > 0 && (
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'rejected'
                    ? 'bg-red-600 text-white font-bold shadow-sm'
                    : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                }`}
              >
                🔴 Rechazados <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10">{countRejected}</span>
              </button>
            )}
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
                  {/* Equipos */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Equipos solicitados</p>
                    <ul className="divide-y divide-border rounded-lg border bg-muted/20">
                      {request.items.map((item, index) => (
                        <li key={`${request.groupId}-${item.equipmentName}-${index}`} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-foreground font-medium">{item.equipmentName}</span>
                          <span className="text-muted-foreground font-mono">x{item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Fecha solicitud (con hora) + Fecha límite con urgencia */}
                  {(() => {
                    const now = new Date();
                    const due = new Date(request.dueDate);
                    due.setHours(23, 59, 59, 999);
                    const diffMs = due.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    const isOverdue = (request as { backendStatus?: string }).backendStatus === 'ATRASADO' || (request.status === 'approved' && diffDays < 0);
                    const isDueToday = request.status === 'approved' && diffDays === 0 && !isOverdue;
                    return (
                      <div className="space-y-2 mb-4">
                        {/* Fecha de solicitud con hora */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>Solicitado: <span className="text-foreground font-medium">{formatDateTime(new Date(request.requestDate))}</span></span>
                        </div>
                        {/* Fecha límite con urgencia */}
                        <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                          isOverdue  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' :
                          isDueToday ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' :
                                       'bg-muted/40 border-border'
                        }`}>
                          <div className="flex items-center gap-2">
                            <CalendarClock className={`w-3.5 h-3.5 shrink-0 ${
                              isOverdue ? 'text-red-500' : isDueToday ? 'text-orange-500' : 'text-muted-foreground'
                            }`} />
                            <div>
                              <p className="text-xs text-muted-foreground">Devolver antes del</p>
                              <p className={`text-sm font-semibold ${
                                isOverdue ? 'text-red-600 dark:text-red-400' :
                                isDueToday ? 'text-orange-600 dark:text-orange-400' :
                                'text-foreground'
                              }`}>{formatDateTime(new Date(request.dueDate), false)}</p>
                            </div>
                          </div>
                          {isOverdue  && <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-900/60 px-2 py-0.5 rounded-full">🔴 VENCIDO</span>}
                          {isDueToday && <span className="text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/60 px-2 py-0.5 rounded-full">⚠️ HOY</span>}
                        </div>
                      </div>
                    );
                  })()}
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
