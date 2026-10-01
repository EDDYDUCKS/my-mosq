'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import {
  createEquipment,
  deleteEquipment,
  fetchEquipment,
  updateEquipment,
  resolveEquipmentImage,
} from '@/lib/api-client';
import { Equipment } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart3,
  Package,
  FileText,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Upload,
  X,
  History,
  ChevronDown,
  ChevronRight,
  Search,
  Wrench,
  LayoutGrid,
  List,
  CheckCircle2,
  Boxes,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

// ── Tipo para agrupar equipos del mismo nombre ──────────────────────────────
interface EquipmentGroup {
  name: string;
  imageUrl: string;
  category: string;
  totalAvailable: number;
  totalStock: number;
  totalMaintenance: number;
  variants: Equipment[];
}

function groupEquipment(items: Equipment[]): EquipmentGroup[] {
  const map = new Map<string, EquipmentGroup>();
  for (const item of items) {
    if (map.has(item.name)) {
      const g = map.get(item.name)!;
      g.totalAvailable += item.available;
      g.totalStock += item.total;
      g.totalMaintenance += (item.maintenance || 0);
      g.variants.push(item);
    } else {
      map.set(item.name, {
        name: item.name,
        imageUrl: item.imageUrl || resolveEquipmentImage(item.name),
        category: item.category,
        totalAvailable: item.available,
        totalStock: item.total,
        totalMaintenance: item.maintenance || 0,
        variants: [item],
      });
    }
  }
  return Array.from(map.values());
}

export default function AdminEquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Equipment>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filtros y visualización
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'low_stock' | 'maintenance'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Grupos expandidos (clave = nombre del grupo)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Estado para la imagen
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadEquipment = async () => {
      try {
        const data = await fetchEquipment();
        if (isMounted) setEquipment(data);
      } catch {
        if (isMounted) setEquipment([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadEquipment();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Métricas KPIs de Cabecera ─────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalVariantes = equipment.length;
    const totalStock = equipment.reduce((acc, eq) => acc + (eq.total || 0), 0);
    const totalAvailable = equipment.reduce((acc, eq) => acc + (eq.available || 0), 0);
    const totalMaintenance = equipment.reduce((acc, eq) => acc + (eq.maintenance || 0), 0);
    const totalInLoan = Math.max(0, totalStock - (totalAvailable + totalMaintenance));
    const criticalCount = equipment.filter(
      (eq) => eq.available === 0 || eq.available <= Math.ceil(eq.total * 0.25)
    ).length;

    return {
      totalVariantes,
      totalStock,
      totalAvailable,
      totalMaintenance,
      totalInLoan,
      criticalCount,
    };
  }, [equipment]);

  // ── Categorías únicas ─────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = new Set<string>();
    equipment.forEach((e) => {
      if (e.category) cats.add(e.category);
    });
    return Array.from(cats).sort();
  }, [equipment]);

  // ── Agrupación + Filtro ───────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    let groups = groupEquipment(equipment);

    // Filtro por categoría
    if (selectedCategory !== 'all') {
      groups = groups.filter((g) => g.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    // Filtro por estado operativo
    if (statusFilter === 'available') {
      groups = groups.filter((g) => g.totalAvailable > 0);
    } else if (statusFilter === 'low_stock') {
      groups = groups.filter(
        (g) => g.totalAvailable === 0 || g.totalAvailable <= Math.ceil(g.totalStock * 0.25)
      );
    } else if (statusFilter === 'maintenance') {
      groups = groups.filter(
        (g) => g.totalMaintenance > 0 || g.variants.some((v) => v.condition === 'maintenance')
      );
    }

    // Filtro por texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      groups = groups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q) ||
          g.variants.some(
            (v) =>
              (v.marca_modelo || '').toLowerCase().includes(q) ||
              (v.color || '').toLowerCase().includes(q) ||
              (v.description || '').toLowerCase().includes(q)
          )
      );
    }

    return groups;
  }, [equipment, selectedCategory, statusFilter, searchQuery]);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const expandAllGroups = () => {
    setExpandedGroups(new Set(filteredGroups.map((g) => g.name)));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  // ── Handlers CRUD ─────────────────────────────────────────────────────────
  const handleEdit = (item: Equipment) => {
    setEditingId(item.id);
    setFormData(item);
    setSelectedImageFile(null);
    setImagePreviewUrl(
      item.imageUrl && !item.imageUrl.includes('placeholder') ? item.imageUrl : null
    );
  };

  const handleImageChange = (file: File | null) => {
    if (file) {
      setSelectedImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    const nombre = formData.name?.trim() || '';
    const descripcion = formData.description?.trim() || '';
    const cantidadTotal = Number(formData.total || 0);
    const cantidadDisponible = Number(formData.available || 0);

    if (!nombre) {
      setSaveError('El nombre del equipo es obligatorio.');
      return;
    }
    if (cantidadTotal < 0 || cantidadDisponible < 0) {
      setSaveError('Las cantidades no pueden ser negativas.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (editingId && editingId !== 'new') {
        const updated = await updateEquipment(editingId, {
          nombre,
          marca_modelo: formData.marca_modelo || '',
          color: formData.color || '',
          descripcion,
          cantidad_total: cantidadTotal,
          cantidad_disponible: cantidadDisponible,
          cantidad_mantenimiento: formData.maintenance || 0,
          imagen: selectedImageFile,
        });
        setEquipment((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
      } else {
        const created = await createEquipment({
          nombre,
          marca_modelo: formData.marca_modelo || '',
          color: formData.color || '',
          descripcion,
          cantidad_total: cantidadTotal,
          cantidad_disponible: cantidadDisponible,
          cantidad_mantenimiento: formData.maintenance || 0,
          imagen: selectedImageFile,
        });
        setEquipment((prev) => [...prev, created]);
        setExpandedGroups((prev) => new Set(prev).add(nombre));
      }
      setEditingId(null);
      setFormData({});
      setIsAddingNew(false);
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      setSaveError(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar. Revisa tu conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteEquipment(id);
    setEquipment((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDialogClose = () => {
    setEditingId(null);
    setFormData({});
    setIsAddingNew(false);
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setSaveError(null);
  };

  const handleAddVariant = (groupName: string) => {
    setIsAddingNew(true);
    setEditingId('new');
    setFormData({ name: groupName });
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
  };

  // ── Helpers de formato ────────────────────────────────────────────────────
  const stockBadgeClass = (available: number, total: number) => {
    if (total === 0) return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    if (available > total * 0.5) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (available > 0) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800';
  };

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Equipos', href: '/admin/equipment', icon: <Package className="w-4 h-4" /> },
    { label: 'Préstamos', href: '/admin/loans', icon: <FileText className="w-4 h-4" /> },
    { label: 'Sanciones', href: '/admin/sanctions', icon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'Auditoría', href: '/admin/audit', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <AppHeader title="Gestión de Equipos" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

          {/* ── Encabezado principal ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Inventario General</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Supervisión de stock, control de mantenimiento y catálogo de materiales deportivos
              </p>
            </div>
            <Button
              onClick={() => {
                setIsAddingNew(true);
                setEditingId('new');
                setFormData({});
                setSelectedImageFile(null);
                setImagePreviewUrl(null);
              }}
              className="bg-[#1b4931] hover:bg-[#163c28] text-white gap-2 font-semibold shadow-xs rounded-xl"
            >
              <Plus className="w-4 h-4" /> Nuevo Equipo
            </Button>
          </div>

          {/* ── Métricas Rápidas (KPIs) ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="rounded-2xl border-border bg-card/70 shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Total en Bodega</span>
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Boxes className="w-4 h-4 text-[#1b4931] dark:text-emerald-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">{kpis.totalStock}</span>
                  <span className="text-xs text-muted-foreground">uds. en {kpis.totalVariantes} modelos</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card/70 shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Disponibles</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {kpis.totalAvailable}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({kpis.totalStock > 0 ? Math.round((kpis.totalAvailable / kpis.totalStock) * 100) : 0}% libre)
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card/70 shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">En Préstamo</span>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {kpis.totalInLoan}
                  </span>
                  <span className="text-xs text-muted-foreground">uds. en uso</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card/70 shadow-xs">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Mantenimiento / Alertas</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Wrench className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {kpis.totalMaintenance}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    reparando · {kpis.criticalCount} críticos
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Barra de Controles y Filtros ── */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              
              {/* Buscador */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por equipo, modelo, color o descripción..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 bg-background border-border rounded-xl text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Botones de Vista (Dual Mode: Grid vs Table) */}
              <div className="flex items-center gap-2 self-end lg:self-auto">
                <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      viewMode === 'grid'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Tarjetas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      viewMode === 'table'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Tabla</span>
                  </button>
                </div>

                {filteredGroups.some((g) => g.variants.length > 1) && (
                  <div className="hidden sm:flex items-center gap-1 text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={expandAllGroups}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Expandir todo
                    </Button>
                    <span className="text-muted-foreground/40">·</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={collapseAllGroups}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Colapsar todo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Chips de Filtros Rápidos (Estado y Categoría) */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" /> Estado:
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  statusFilter === 'all'
                    ? 'bg-[#1b4931] text-white border-[#1b4931] font-semibold'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Todos ({equipment.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('available')}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  statusFilter === 'available'
                    ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Disponibles
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('low_stock')}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  statusFilter === 'low_stock'
                    ? 'bg-red-600 text-white border-red-600 font-semibold'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Stock Bajo / Agotado ({kpis.criticalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('maintenance')}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  statusFilter === 'maintenance'
                    ? 'bg-amber-600 text-white border-amber-600 font-semibold'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                En Mantenimiento ({kpis.totalMaintenance})
              </button>

              {/* Selector de Categoría */}
              {categories.length > 0 && (
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-muted-foreground font-medium">Categoría:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-7 text-xs rounded-lg border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">Todas las categorías</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── Contenido: MODO TARJETAS (GRID UNIFICADO) ── */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map((group) => {
                const isSingle = group.variants.length === 1;
                const isExpanded = expandedGroups.has(group.name);
                const single = group.variants[0];

                return (
                  <Card
                    key={group.name}
                    className="rounded-2xl border border-border overflow-hidden bg-card shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    {/* Header Imagen + Categoría */}
                    <div>
                      <div className="relative h-44 bg-[#e9edf0] dark:bg-zinc-900 border-b border-border/60">
                        <img
                          src={group.imageUrl}
                          alt={group.name}
                          className="absolute inset-0 w-full h-full object-contain p-3"
                          onError={(e) => {
                            const fallback = resolveEquipmentImage(group.name);
                            if (e.currentTarget.src !== window.location.origin + fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                        />
                        <div className="absolute top-3 left-3 rounded-lg bg-black/60 backdrop-blur-xs px-2.5 py-1 text-[11px] font-medium text-white">
                          {group.category}
                        </div>
                        <div className="absolute top-3 right-3">
                          <Badge
                            className={`${stockBadgeClass(
                              group.totalAvailable,
                              group.totalStock
                            )} text-xs border font-semibold shadow-xs`}
                          >
                            {group.totalAvailable} / {group.totalStock} disp.
                          </Badge>
                        </div>
                      </div>

                      {/* Título y detalles principales */}
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-base text-foreground line-clamp-1">
                              {group.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isSingle ? '1 modelo registrado' : `${group.variants.length} modelos / variantes`}
                            </p>
                          </div>
                          {group.totalMaintenance > 0 && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[11px] gap-1 border-amber-200 dark:border-amber-800 shrink-0">
                              <Wrench className="w-3 h-3" /> {group.totalMaintenance} mant.
                            </Badge>
                          )}
                        </div>

                        {/* Caso: 1 solo modelo */}
                        {isSingle && (
                          <div className="mt-4 pt-3 border-t border-border/60 space-y-2.5 text-xs text-muted-foreground">
                            {single.description && (
                              <p className="line-clamp-2 text-foreground/80">{single.description}</p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {single.marca_modelo && (
                                <span>
                                  <strong className="text-foreground">Modelo:</strong> {single.marca_modelo}
                                </span>
                              )}
                              {single.color && (
                                <span>
                                  <strong className="text-foreground">Color:</strong> {single.color}
                                </span>
                              )}
                              <span>
                                <strong className="text-foreground">Condición:</strong>{' '}
                                <span className="capitalize">{single.condition}</span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Caso: Múltiples modelos (Acordeón colapsable homogéneo) */}
                        {!isSingle && (
                          <div className="mt-4 pt-3 border-t border-border/60">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.name)}
                              className="w-full flex items-center justify-between text-xs font-semibold text-primary hover:text-primary/80 transition-colors py-1"
                            >
                              <span>
                                {isExpanded ? 'Ocultar desglose' : 'Ver marcas y modelos disponibles'}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="mt-2.5 space-y-2 pt-2 border-t border-border/40">
                                {group.variants.map((v) => (
                                  <div
                                    key={v.id}
                                    className="p-2.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between gap-2 text-xs"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-foreground truncate">
                                        {v.marca_modelo || 'Modelo General'}
                                      </p>
                                      <p className="text-muted-foreground text-[11px]">
                                        {v.color ? `Color: ${v.color}` : 'Estándar'} · {v.available}/{v.total} disp.
                                        {(v.maintenance || 0) > 0 && ` (${v.maintenance} mant.)`}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEdit(v)}
                                        className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                                        title="Editar variante"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDelete(v.id)}
                                        className="h-7 w-7 p-0 rounded-lg text-red-600 hover:text-white hover:bg-red-600 border-red-200 dark:border-red-900"
                                        title="Eliminar variante"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddVariant(group.name)}
                                  className="w-full h-8 text-xs font-medium border-dashed border-primary/50 text-primary hover:bg-primary/5 rounded-xl mt-1"
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Agregar modelo a {group.name}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer de Acciones (para el caso single o botones generales) */}
                    {isSingle && (
                      <div className="p-4 sm:p-5 pt-0 mt-auto flex items-center gap-2 border-t border-border/40">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(single)}
                          className="flex-1 h-9 rounded-xl text-xs font-semibold gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(single.id)}
                          className="flex-1 h-9 rounded-xl text-xs font-semibold gap-1.5 text-red-600 hover:bg-red-600 hover:text-white border-red-200 dark:border-red-900"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Contenido: MODO TABLA COMPACTA (DATA TABLE) ── */}
          {viewMode === 'table' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Disponibles</TableHead>
                    <TableHead className="text-center">En Préstamo</TableHead>
                    <TableHead className="text-center">Mantenimiento</TableHead>
                    <TableHead>Estado Stock</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.map((group) => {
                    const isSingle = group.variants.length === 1;
                    const isExpanded = expandedGroups.has(group.name);
                    const single = group.variants[0];
                    const inLoanGroup = Math.max(
                      0,
                      group.totalStock - (group.totalAvailable + group.totalMaintenance)
                    );

                    return (
                      <React.Fragment key={group.name}>
                        {/* Fila principal del grupo */}
                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-center">
                            {!isSingle && (
                              <button
                                type="button"
                                onClick={() => toggleGroup(group.name)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative w-10 h-10 rounded-lg bg-[#e9edf0] shrink-0 overflow-hidden border border-border">
                                <img
                                  src={group.imageUrl}
                                  alt={group.name}
                                  className="w-full h-full object-contain p-1"
                                  onError={(e) => {
                                    const fallback = resolveEquipmentImage(group.name);
                                    if (e.currentTarget.src !== window.location.origin + fallback) {
                                      e.currentTarget.src = fallback;
                                    }
                                  }}
                                />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm leading-tight">
                                  {group.name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {isSingle
                                    ? single.marca_modelo || 'Modelo General'
                                    : `${group.variants.length} modelos registrados`}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">
                              {group.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold text-foreground">
                            {group.totalStock}
                          </TableCell>
                          <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {group.totalAvailable}
                          </TableCell>
                          <TableCell className="text-center font-medium text-blue-600 dark:text-blue-400">
                            {inLoanGroup}
                          </TableCell>
                          <TableCell className="text-center">
                            {group.totalMaintenance > 0 ? (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs gap-1 border-amber-200 dark:border-amber-800">
                                <Wrench className="w-3 h-3" /> {group.totalMaintenance}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${stockBadgeClass(
                                group.totalAvailable,
                                group.totalStock
                              )} text-xs border font-medium`}
                            >
                              {group.totalAvailable === 0
                                ? 'Agotado'
                                : group.totalAvailable <= Math.ceil(group.totalStock * 0.25)
                                ? 'Crítico'
                                : 'Normal'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isSingle ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(single)}
                                  className="h-8 px-2.5 text-xs rounded-lg"
                                >
                                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(single.id)}
                                  className="h-8 px-2 text-xs rounded-lg text-red-600 hover:bg-red-600 hover:text-white border-red-200 dark:border-red-900"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddVariant(group.name)}
                                  className="h-8 px-2.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg border-dashed border-primary/50"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" /> Variante
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Subfilas de variantes para grupos con múltiples modelos */}
                        {!isSingle &&
                          isExpanded &&
                          group.variants.map((v) => {
                            const vInLoan = Math.max(
                              0,
                              v.total - (v.available + (v.maintenance || 0))
                            );
                            return (
                              <TableRow
                                key={v.id}
                                className="bg-muted/15 hover:bg-muted/25 transition-colors text-xs"
                              >
                                <TableCell></TableCell>
                                <TableCell className="pl-12">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                    <span className="font-semibold text-foreground">
                                      {v.marca_modelo || 'Modelo General'}
                                    </span>
                                    {v.color && (
                                      <span className="text-muted-foreground">· Color: {v.color}</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{v.category}</TableCell>
                                <TableCell className="text-center font-medium">{v.total}</TableCell>
                                <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">
                                  {v.available}
                                </TableCell>
                                <TableCell className="text-center text-blue-600 dark:text-blue-400">
                                  {vInLoan}
                                </TableCell>
                                <TableCell className="text-center">
                                  {(v.maintenance || 0) > 0 ? (
                                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] border-amber-200 dark:border-amber-800">
                                      {v.maintenance}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="capitalize text-muted-foreground">
                                    {v.condition}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEdit(v)}
                                      className="h-7 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground"
                                    >
                                      <Edit2 className="w-3 h-3 mr-1" /> Editar
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(v.id)}
                                      className="h-7 px-2 text-xs rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mensaje de vacío */}
          {!loading && filteredGroups.length === 0 && (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-border bg-card/50 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-foreground text-sm">No se encontraron equipos</p>
              <p className="text-xs mt-1">
                {searchQuery || selectedCategory !== 'all' || statusFilter !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda o categoría.'
                  : 'No hay equipos registrados en el inventario.'}
              </p>
              {(searchQuery || selectedCategory !== 'all' || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setStatusFilter('all');
                  }}
                  className="mt-3 text-xs rounded-xl"
                >
                  Restablecer filtros
                </Button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Diálogo Editar / Agregar ── */}
      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) handleDialogClose();
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {isAddingNew || editingId === 'new' ? 'Nuevo Equipo Deportivo' : 'Editar Equipo'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isAddingNew || editingId === 'new'
                ? 'Registra un nuevo artículo o variante en el catálogo de deportes'
                : 'Actualiza los datos técnicos, existencias o estado del equipo'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Campo: Imagen */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fotografía del equipo</Label>
              {imagePreviewUrl ? (
                <div className="relative w-full h-36 rounded-xl border border-border overflow-hidden bg-[#e9edf0] dark:bg-zinc-900">
                  <img
                    src={imagePreviewUrl}
                    alt="Vista previa"
                    className="absolute inset-0 w-full h-full object-contain p-2"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-xs"
                    aria-label="Quitar imagen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) handleImageChange(file);
                  }}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground bg-muted/20"
                >
                  <Upload className="w-6 h-6 text-muted-foreground/60" />
                  <span className="text-xs font-medium">Haz clic o arrastra una imagen</span>
                  <span className="text-[10px] text-muted-foreground">PNG, JPG, WEBP (máx. 5MB)</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
              />
            </div>

            {/* Campo: Nombre */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">
                Nombre del equipo *
              </Label>
              <Input
                id="name"
                placeholder="Ej: Balón de Baloncesto"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="rounded-xl border-border text-sm"
              />
            </div>

            {/* Campos: Modelo y Color */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="marca_modelo" className="text-xs font-semibold">
                  Marca / Modelo
                </Label>
                <Input
                  id="marca_modelo"
                  placeholder="Ej: Molten GG7X"
                  value={formData.marca_modelo || ''}
                  onChange={(e) => setFormData({ ...formData, marca_modelo: e.target.value })}
                  className="rounded-xl border-border text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color" className="text-xs font-semibold">
                  Color
                </Label>
                <Input
                  id="color"
                  placeholder="Ej: Naranja / Negro"
                  value={formData.color || ''}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="rounded-xl border-border text-sm"
                />
              </div>
            </div>

            {/* Campos: Disponibles / Mantenimiento / Total */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="available" className="text-xs font-semibold">
                  Disponibles
                </Label>
                <Input
                  id="available"
                  type="number"
                  min="0"
                  value={formData.available ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, available: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                  className="rounded-xl border-border text-center font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maintenance" className="text-xs font-semibold">
                  Mantenimiento
                </Label>
                <Input
                  id="maintenance"
                  type="number"
                  min="0"
                  value={formData.maintenance ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, maintenance: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                  className="rounded-xl border-border text-center font-bold text-amber-600 dark:text-amber-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="total" className="text-xs font-semibold">
                  Total Bodega
                </Label>
                <Input
                  id="total"
                  type="number"
                  min="0"
                  value={formData.total ?? 0}
                  onChange={(e) =>
                    setFormData({ ...formData, total: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                  className="rounded-xl border-border text-center font-bold text-foreground"
                />
              </div>
            </div>

            {/* Campo: Categoría */}
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-semibold">
                Categoría
              </Label>
              <Input
                id="category"
                placeholder="Ej: Baloncesto, Fútbol, Voleibol..."
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="rounded-xl border-border text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 flex-col sm:flex-row sm:items-center">
            {saveError && (
              <p className="text-xs text-destructive flex-1 text-left flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {saveError}
              </p>
            )}
            <Button
              variant="outline"
              onClick={handleDialogClose}
              disabled={isSaving}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#1b4931] hover:bg-[#163c28] text-white font-semibold rounded-xl text-xs"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedLayout>
  );
}
