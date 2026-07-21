'use client';

import Image from 'next/image';
import React, { useEffect, useState, useRef } from 'react';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { createEquipment, deleteEquipment, fetchEquipment, updateEquipment } from '@/lib/api-client';
import { Equipment } from '@/lib/types';
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
import { 
  BarChart3, 
  Package,
  FileText,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Upload,
  X
} from 'lucide-react';

export default function AdminEquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Equipment>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estado para la imagen
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadEquipment = async () => {
      try {
        const data = await fetchEquipment();
        if (isMounted) {
          setEquipment(data);
        }
      } catch {
        if (isMounted) {
          setEquipment([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadEquipment();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleEdit = (item: Equipment) => {
    setEditingId(item.id);
    setFormData(item);
    setSelectedImageFile(null);
    // Mostrar la imagen existente del equipo como preview
    setImagePreviewUrl(item.imageUrl && !item.imageUrl.includes('placeholder') ? item.imageUrl : null);
  };

  const handleImageChange = (file: File | null) => {
    if (file) {
      setSelectedImageFile(file);
      // Crear preview local
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const nombre = formData.name?.trim() || '';
    const descripcion = formData.description?.trim() || '';
    const cantidadTotal = Number(formData.total || 0);
    const cantidadDisponible = Number(formData.available || 0);

    if (!nombre || cantidadTotal < 0 || cantidadDisponible < 0) {
      return;
    }

    if (editingId && editingId !== 'new') {
      const updated = await updateEquipment(editingId, {
        nombre,
        marca_modelo: formData.marca_modelo || '',
        color: formData.color || '',
        descripcion,
        cantidad_total: cantidadTotal,
        cantidad_disponible: cantidadDisponible,
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
        imagen: selectedImageFile,
      });
      setEquipment((prev) => [...prev, created]);
    }
    setEditingId(null);
    setFormData({});
    setIsAddingNew(false);
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
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
  };

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Equipos', href: '/admin/equipment', icon: <Package className="w-4 h-4" /> },
    { label: 'Préstamos', href: '/admin/loans', icon: <FileText className="w-4 h-4" /> },
    { label: 'Sanciones', href: '/admin/sanctions', icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  return (
    <ProtectedLayout allowedRoles={['admin']}>
      <AppHeader title="Gestión de Equipos" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-8">
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
              <Plus className="w-4 h-4" />
              Nuevo Equipo
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {equipment.map((item) => (
              <div key={item.id} className="aspect-square">
                <Card className="h-full flex flex-col overflow-hidden hover:shadow-lg transition-shadow py-0 gap-0">
                  <div className="relative h-1/2 bg-[#e9edf0]">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-contain p-2"
                    />
                    <div className="absolute bottom-3 left-3 rounded-full bg-black/40 px-3 py-1 text-xs text-white">
                      {item.category}
                    </div>
                  </div>

                  <CardContent className="flex-1 flex flex-col justify-between p-4">
                    <div>
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      <CardDescription className="text-sm mt-1 text-muted-foreground">
                        {item.description}
                      </CardDescription>
                      {(item.marca_modelo || item.color) && (
                        <div className="mt-2 text-xs text-muted-foreground flex flex-col gap-0.5">
                          {item.marca_modelo && <span><span className="font-medium text-foreground">Modelo:</span> {item.marca_modelo}</span>}
                          {item.color && <span><span className="font-medium text-foreground">Color:</span> {item.color}</span>}
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          Condición: <span className="font-semibold capitalize">{item.condition}</span>
                        </div>
                        <Badge className={
                          item.available > item.total * 0.5
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : item.available > 0
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }>
                          {item.available}/{item.total}
                        </Badge>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="gap-1 flex-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          className="gap-1 flex-1 bg-transparent border-red-600 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
            {!loading && equipment.length === 0 && (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                No hay equipos registrados.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit/Add Dialog */}
      <Dialog open={editingId !== null} onOpenChange={(open) => {
        if (!open) {
          handleDialogClose();
        }
      }}>
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
                  <Image
                    src={imagePreviewUrl}
                    alt="Vista previa"
                    fill
                    className="object-contain p-2"
                  />
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
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      handleImageChange(file);
                    }
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
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  handleImageChange(file);
                }}
              />
            </div>

            {/* Campo: Nombre */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, marca_modelo: e.target.value })}
                  className="border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  placeholder="Ej: Blanco con azul"
                  value={formData.color || ''}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="border-input"
                />
              </div>
            </div>

            {/* Campos: Disponibles / Total */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="available">Disponibles</Label>
                <Input
                  id="available"
                  type="number"
                  value={formData.available || 0}
                  onChange={(e) => setFormData({ ...formData, available: parseInt(e.target.value) })}
                  className="border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total">Total</Label>
                <Input
                  id="total"
                  type="number"
                  value={formData.total || 0}
                  onChange={(e) => setFormData({ ...formData, total: parseInt(e.target.value) })}
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
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="border-input"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleDialogClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedLayout>
  );
}

