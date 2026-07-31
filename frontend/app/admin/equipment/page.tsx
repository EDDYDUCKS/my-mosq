'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { createEquipment, deleteEquipment, fetchEquipment, updateEquipment, resolveEquipmentImage } from '@/lib/api-client';
import { Equipment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';

// ── Tipo para agrupar equipos del mismo nombre ──────────────────────────────
interface EquipmentGroup {
  name: string;
  imageUrl: string;
  category: string;
  totalAvailable: number;
  totalStock: number;
  variants: Equipment[];
}

function groupEquipment(items: Equipment[]): EquipmentGroup[] {
  const map = new Map<string, EquipmentGroup>();
  for (const item of items) {
    if (map.has(item.name)) {
      const g = map.get(item.name)!;
      g.totalAvailable += item.available;
      g.totalStock     += item.total;
      g.variants.push(item);
    } else {
      map.set(item.name, {
        name:           item.name,
        imageUrl:       item.imageUrl || resolveEquipmentImage(item.name),
        category:       item.category,
        totalAvailable: item.available,
        totalStock:     item.total,
        variants:       [item],
      });
    }
  }
  return Array.from(map.values());
}

export default function AdminEquipmentPage() {
  const [equipment, setEquipment]           = useState<Equipment[]>([]);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [formData, setFormData]             = useState<Partial<Equipment>>({});
  const [isAddingNew, setIsAddingNew]       = useState(false);
  const [loading, setLoading]               = useState(true);
  const [isSaving, setIsSaving]             = useState(false);
  const [saveError, setSaveError]           = useState<string | null>(null);
  const [searchQuery, setSearchQuery]       = useState('');

  // Grupos expandidos (clave = nombre del grupo)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Estado para la imagen
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl]     = useState<string | null>(null);
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
    return () => { isMounted = false; };
  }, []);

  // ── Agrupación + filtro ───────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    const groups = groupEquipment(equipment);
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.variants.some(v =>
        (v.marca_modelo || '').toLowerCase().includes(q) ||
        (v.color        || '').toLowerCase().includes(q)
      )
    );
  }, [equipment, searchQuery]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // ── Handlers CRUD (sin cambios respecto al original) ─────────────────────
  const handleEdit = (item: Equipment) => {
    setEditingId(item.id);
    setFormData(item);
    setSelectedImageFile(null);
    setImagePreviewUrl(item.imageUrl && !item.imageUrl.includes('placeholder') ? item.imageUrl : null);
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
    const nombre             = formData.name?.trim() || '';
    const descripcion        = formData.description?.trim() || '';
    const cantidadTotal      = Number(formData.total     || 0);
    const cantidadDisponible = Number(formData.available || 0);

    if (!nombre) { setSaveError('El nombre del equipo es obligatorio.'); return; }
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
          marca_modelo:           formData.marca_modelo || '',
          color:                  formData.color || '',
          descripcion,
          cantidad_total:         cantidadTotal,
          cantidad_disponible:    cantidadDisponible,
          cantidad_mantenimiento: formData.maintenance || 0,
          imagen:                 selectedImageFile,
        });
        setEquipment(prev => prev.map(item => item.id === editingId ? updated : item));
      } else {
        const created = await createEquipment({
          nombre,
          marca_modelo:           formData.marca_modelo || '',
          color:                  formData.color || '',
          descripcion,
          cantidad_total:         cantidadTotal,
          cantidad_disponible:    cantidadDisponible,
          cantidad_mantenimiento: formData.maintenance || 0,
          imagen:                 selectedImageFile,
        });
        setEquipment(prev => [...prev, created]);
        // Expandir el grupo para que se vea la variante recién creada
        setExpandedGroups(prev => new Set(prev).add(nombre));
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
    setEquipment(prev => prev.filter(item => item.id !== id));
  };

  const handleDialogClose = () => {
    setEditingId(null);
    setFormData({});
    setIsAddingNew(false);
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
  };

  // Abre el formulario nuevo con el nombre del grupo pre-rellenado
  const handleAddVariant = (groupName: string) => {
    setIsAddingNew(true);
    setEditingId('new');
    setFormData({ name: groupName });
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const stockBadgeClass = (available: number, total: number) =>
    available > total * 0.5
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : available > 0
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

  const navItems = [
    { label: 'Dashboard', href: '/admin',           icon: <BarChart3     className="w-4 h-4" /> },
    { label: 'Equipos',   href: '/admin/equipment', icon: <Package       className="w-4 h-4" /> },
    { label: 'Préstamos', href: '/admin/loans',      icon: <FileText      className="w-4 h-4" /> },
    { label: 'Sanciones', href: '/admin/sanctions',  icon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'Auditoría', href: '/admin/audit',      icon: <History       className="w-4 h-4" /> },
  ];

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <AppHeader title="Gestión de Equipos" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Equipos</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gestiona el inventario de equipos deportivos
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Plus className="w-4 h-4" /> Nuevo Equipo
            </Button>
          </div>

          {/* ── Buscador ── */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, modelo o color..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>

          {/* ── Grid de grupos ── */}
          <div className="space-y-4">
            {filteredGroups.map(group => {
              const isSingle   = group.variants.length === 1;
              const isExpanded = expandedGroups.has(group.name);
              const single     = group.variants[0];

              // ── Un solo modelo → tarjeta cuadrada original ───────────────
              if (isSingle) {
                return (
                  <div key={single.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="aspect-square">
                      <Card className="h-full flex flex-col overflow-hidden hover:shadow-lg transition-shadow py-0 gap-0">
                        <div className="relative h-1/2 bg-[#e9edf0]">
                          <img
                            src={single.imageUrl}
                            alt={single.name}
                            className="absolute inset-0 w-full h-full object-contain p-2"
                            onError={e => {
                              const fallback = resolveEquipmentImage(single.name);
                              if (e.currentTarget.src !== window.location.origin + fallback)
                                e.currentTarget.src = fallback;
                            }}
                          />
                          <div className="absolute bottom-3 left-3 rounded-full bg-black/40 px-3 py-1 text-xs text-white">
                            {single.category}
                          </div>
                        </div>

                        <CardContent className="flex-1 flex flex-col justify-between p-4">
                          <div>
                            <CardTitle className="text-lg">{single.name}</CardTitle>
                            <CardDescription className="text-sm mt-1 text-muted-foreground">
                              {single.description}
                            </CardDescription>
                            {(single.marca_modelo || single.color) && (
                              <div className="mt-2 text-xs text-muted-foreground flex flex-col gap-0.5">
                                {single.marca_modelo && <span><span className="font-medium text-foreground">Modelo:</span> {single.marca_modelo}</span>}
                                {single.color        && <span><span className="font-medium text-foreground">Color:</span> {single.color}</span>}
                              </div>
                            )}
                          </div>
                          <div className="mt-4">
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <div className="text-xs text-muted-foreground">
                                Condición: <span className="font-semibold capitalize">
                                  {single.condition === 'maintenance' ? '🛠️ Mantenimiento' : single.condition}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {(single.maintenance || 0) > 0 && (
                                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                                    🛠️ {single.maintenance}
                                  </Badge>
                                )}
                                <Badge className={stockBadgeClass(single.available, single.total)}>
                                  {single.available}/{single.total}
                                </Badge>
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleEdit(single)} className="gap-1 flex-1">
                                <Edit2 className="w-4 h-4" /> Editar
                              </Button>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => handleDelete(single.id)}
                                className="gap-1 flex-1 bg-transparent border-red-600 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600"
                              >
                                <Trash2 className="w-4 h-4" /> Eliminar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              }

              // ── Múltiples modelos → tarjeta de grupo colapsable ──────────
              return (
                <Card key={group.name} className="overflow-hidden border-2 border-border hover:shadow-md transition-shadow">

                  {/* Header clickable */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="relative w-14 h-14 rounded-lg bg-[#e9edf0] shrink-0 overflow-hidden">
                      <img
                        src={group.imageUrl}
                        alt={group.name}
                        className="absolute inset-0 w-full h-full object-contain p-1"
                        onError={e => {
                          const fallback = resolveEquipmentImage(group.name);
                          if (e.currentTarget.src !== window.location.origin + fallback)
                            e.currentTarget.src = fallback;
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-base truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {group.variants.length} variantes · {group.category}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className={stockBadgeClass(group.totalAvailable, group.totalStock)}>
                        {group.totalAvailable}/{group.totalStock} total
                      </Badge>
                      {isExpanded
                        ? <ChevronDown  className="w-4 h-4 text-muted-foreground" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                  </button>

                  {/* Lista de variantes */}
                  {isExpanded && (
                    <div className="border-t border-border divide-y divide-border">
                      {group.variants.map(v => (
                        <div key={v.id} className="flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0 text-sm">
                            <span className="font-medium text-foreground">
                              {v.marca_modelo || <span className="text-muted-foreground italic">Sin modelo</span>}
                            </span>
                            {v.color && <span className="text-muted-foreground"> · {v.color}</span>}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {(v.maintenance || 0) > 0 && (
                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 text-xs">
                                🛠️ {v.maintenance}
                              </Badge>
                            )}
                            <Badge className={`${stockBadgeClass(v.available, v.total)} text-xs`}>
                              {v.available}/{v.total}
                            </Badge>
                          </div>

                          <div className="flex gap-1.5 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(v)} className="gap-1 h-8 px-2 text-xs">
                              <Edit2 className="w-3.5 h-3.5" /> Editar
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => handleDelete(v.id)}
                              className="gap-1 h-8 px-2 text-xs bg-transparent border-red-600 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Eliminar
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Botón agregar variante */}
                      <div className="px-4 py-2.5 bg-muted/10">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => handleAddVariant(group.name)}
                          className="gap-1.5 text-xs border-dashed border-primary/60 text-primary hover:bg-primary/10"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Agregar variante a "{group.name}"
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            {!loading && filteredGroups.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                {searchQuery
                  ? `No se encontraron equipos que coincidan con "${searchQuery}".`
                  : 'No hay equipos registrados.'}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Diálogo Editar / Agregar (idéntico al original) ── */}
      <Dialog open={editingId !== null} onOpenChange={open => { if (!open) handleDialogClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isAddingNew || editingId === 'new' ? 'Nuevo Equipo' : 'Editar Equipo'}
            </DialogTitle>
            <DialogDescription>
              {isAddingNew || editingId === 'new'
                ? 'Agrega un nuevo equipo al inventario'
                : 'Actualiza los detalles del equipo'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Campo: Imagen */}
            <div className="space-y-2">
              <Label>Imagen del equipo</Label>
              {imagePreviewUrl ? (
                <div className="relative w-full h-40 rounded-lg border border-input overflow-hidden bg-[#e9edf0]">
                  <img src={imagePreviewUrl} alt="Vista previa" className="absolute inset-0 w-full h-full object-contain p-2" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    aria-label="Quitar imagen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) handleImageChange(file);
                  }}
                  className="w-full h-40 rounded-lg border-2 border-dashed border-input hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm font-medium">Haz clic o arrastra una imagen</span>
                  <span className="text-xs">PNG, JPG, WEBP (máx. 5MB)</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleImageChange(e.target.files?.[0] || null)}
              />
            </div>

            {/* Campo: Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="border-input"
              />
            </div>

            {/* Campos: Modelo y Color */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marca_modelo">Marca / Modelo</Label>
                <Input
                  id="marca_modelo"
                  placeholder="Ej: MOLTEN F523"
                  value={formData.marca_modelo || ''}
                  onChange={e => setFormData({ ...formData, marca_modelo: e.target.value })}
                  className="border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  placeholder="Ej: Blanco con azul"
                  value={formData.color || ''}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                  className="border-input"
                />
              </div>
            </div>

            {/* Campos: Disponibles / Mantenimiento / Total */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="available">Disponibles</Label>
                <Input
                  id="available"
                  type="number"
                  value={formData.available || 0}
                  onChange={e => setFormData({ ...formData, available: parseInt(e.target.value) })}
                  className="border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenance">En Mantenimiento</Label>
                <Input
                  id="maintenance"
                  type="number"
                  value={formData.maintenance || 0}
                  onChange={e => setFormData({ ...formData, maintenance: parseInt(e.target.value) })}
                  className="border-input text-orange-600 font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total">Total Bodega</Label>
                <Input
                  id="total"
                  type="number"
                  value={formData.total || 0}
                  onChange={e => setFormData({ ...formData, total: parseInt(e.target.value) })}
                  className="border-input"
                />
              </div>
            </div>

            {/* Campo: Categoría */}
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Input
                id="category"
                value={formData.category || ''}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="border-input"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col items-stretch sm:flex-row sm:items-center">
            {saveError && (
              <p className="text-sm text-destructive flex-1 text-left">⚠️ {saveError}</p>
            )}
            <Button variant="outline" onClick={handleDialogClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedLayout>
  );
}
