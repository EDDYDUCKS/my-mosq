'use client';

import React, { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { Sanction } from '@/lib/types';
import { createSanction, deleteSanction, fetchSanctions, resolveSanction, fetchStudents } from '@/lib/api-client';
import { User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  BarChart3, 
  Package,
  FileText,
  AlertTriangle,
  Plus,
  Trash2
} from 'lucide-react';

export default function AdminSanctionsPage() {
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [newSanction, setNewSanction] = useState<Partial<Sanction>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setSearching(true);
        try {
          const results = await fetchStudents(searchTerm);
          setSearchResults(results);
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const loadSanctions = async () => {
    try {
      const data = await fetchSanctions();
      setSanctions(data);
    } catch {
      setSanctions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSanctions();
  }, []);

  const handleAddSanction = async () => {
    if (submitting) return;
    if (newSanction.studentId && newSanction.reason && newSanction.severity) {
      setSubmitting(true);
      try {
        await createSanction({
          studentId: newSanction.studentId,
          reason: newSanction.reason,
          severity: newSanction.severity,
          expiryDate: newSanction.expiryDate,
          notes: newSanction.notes,
        });
        await loadSanctions();
      } finally {
        setSubmitting(false);
      }
      setNewSanction({});
      setSelectedStudent(null);
      setSearchTerm('');
      setDialogOpen(false);
    }
  };

  const handleResolve = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await resolveSanction(id);
      await loadSanctions();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await deleteSanction(id);
      await loadSanctions();
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'restriction':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'ban':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Equipos', href: '/admin/equipment', icon: <Package className="w-4 h-4" /> },
    { label: 'Préstamos', href: '/admin/loans', icon: <FileText className="w-4 h-4" /> },
    { label: 'Sanciones', href: '/admin/sanctions', icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  const now = new Date();
  const activeSanctions = sanctions.filter(
    (s) => (s.isActive !== false) && (!s.expiryDate || new Date(s.expiryDate) > now),
  );
  const expiredSanctions = sanctions.filter(
    (s) => (s.isActive === false) || (s.expiryDate ? new Date(s.expiryDate) <= now : false),
  );

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <AppHeader title="Gestión de Sanciones" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Sanciones</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gestiona las sanciones de estudiantes
              </p>
            </div>
            <Button
              onClick={() => {
                setNewSanction({});
                setSelectedStudent(null);
                setSearchTerm('');
                setDialogOpen(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Plus className="w-4 h-4" />
              Nueva Sanción
            </Button>
          </div>

          {/* Active Sanctions */}
          {activeSanctions.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-foreground mb-4">Sanciones Activas ({activeSanctions.length})</h3>
              <div className="grid gap-4">
                {activeSanctions.map((sanction) => (
                  <Card key={sanction.id} className="border-red-200 dark:border-red-800">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{sanction.studentName}</CardTitle>
                          <CardDescription className="text-sm mt-1">
                            ID Estudiante: {sanction.studentId}
                          </CardDescription>
                        </div>
                        <Badge className={getSeverityColor(sanction.severity)}>
                          {sanction.severity === 'warning' && 'Advertencia'}
                          {sanction.severity === 'restriction' && 'Restricción'}
                          {sanction.severity === 'ban' && 'Prohibición'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Motivo</p>
                          <p className="text-sm text-foreground">{sanction.reason}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Fecha</p>
                            <p className="text-sm text-foreground">
                              {new Date(sanction.date).toLocaleDateString('es-NI')}
                            </p>
                          </div>
                          {sanction.expiryDate && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase">Vence</p>
                              <p className="text-sm text-foreground">
                                {new Date(sanction.expiryDate).toLocaleDateString('es-NI')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(sanction.id)}
                        disabled={submitting}
                        className="w-full mt-4 gap-2 bg-transparent border-yellow-600 text-yellow-700 hover:bg-yellow-600 hover:text-white hover:border-yellow-600"
                      >
                        Levantar Sanción
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(sanction.id)}
                        disabled={submitting}
                        className="w-full mt-4 gap-2 bg-transparent border-red-600 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar Sanción
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Expired Sanctions */}
          {expiredSanctions.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Sanciones Vencidas ({expiredSanctions.length})</h3>
              <div className="grid gap-4">
                {expiredSanctions.map((sanction) => (
                  <Card key={sanction.id} className="opacity-75">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{sanction.studentName}</CardTitle>
                          <CardDescription className="text-sm mt-1">
                            ID Estudiante: {sanction.studentId}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">Vencida</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Motivo</p>
                          <p className="text-sm text-foreground">{sanction.reason}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Venció el</p>
                          <p className="text-sm text-foreground">
                            {sanction.expiryDate && new Date(sanction.expiryDate).toLocaleDateString('es-NI')}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(sanction.id)}
                        disabled={submitting}
                        className="w-full gap-2 bg-transparent border-red-600 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!loading && sanctions.length === 0 && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-muted-foreground">No hay sanciones registradas</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Add Sanction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Sanción</DialogTitle>
            <DialogDescription>
              Registra una sanción para un estudiante
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2 relative">
              <Label htmlFor="student-search">Estudiante</Label>
              {selectedStudent ? (
                <div className="flex items-center justify-between p-2 border rounded-md bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <div>
                    <p className="text-sm font-medium">{selectedStudent.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedStudent.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50"
                    onClick={() => {
                      setSelectedStudent(null);
                      setNewSanction({ ...newSanction, studentId: undefined });
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="student-search"
                    placeholder="Buscar por nombre, carnet o correo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-input"
                    autoComplete="off"
                  />
                  {searching && <p className="text-xs text-muted-foreground mt-1">Buscando...</p>}
                  {searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map(user => (
                        <div
                          key={user.id}
                          className="p-2 cursor-pointer hover:bg-muted border-b last:border-0"
                          onClick={() => {
                            setSelectedStudent(user);
                            setNewSanction({ ...newSanction, studentId: user.id });
                            setSearchTerm('');
                            setSearchResults([]);
                          }}
                        >
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea
                id="reason"
                placeholder="Describe el motivo de la sanción..."
                value={newSanction.reason || ''}
                onChange={(e) => setNewSanction({ ...newSanction, reason: e.target.value })}
                className="border-input resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severidad</Label>
              <select
                id="severity"
                value={newSanction.severity || ''}
                onChange={(e) => setNewSanction({ ...newSanction, severity: e.target.value as any })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="">Selecciona una severidad</option>
                <option value="warning">Advertencia</option>
                <option value="restriction">Restricción</option>
                <option value="ban">Prohibición</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry-date">Fecha de Vencimiento (Opcional)</Label>
              <Input
                id="expiry-date"
                type="date"
                value={newSanction.expiryDate
                  ? new Date(newSanction.expiryDate).toISOString().split('T')[0]
                  : ''}
                onChange={(e) => setNewSanction({ ...newSanction, expiryDate: e.target.value ? new Date(e.target.value) : undefined })}
                className="border-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sanction-notes">Observaciones (Opcional)</Label>
              <Textarea
                id="sanction-notes"
                placeholder="Detalles adicionales"
                value={newSanction.notes || ''}
                onChange={(e) => setNewSanction({ ...newSanction, notes: e.target.value })}
                className="border-input resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddSanction}
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? 'Guardando...' : 'Crear Sanción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedLayout>
  );
}
