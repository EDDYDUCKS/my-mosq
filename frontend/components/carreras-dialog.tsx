'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GraduationCap, Plus, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Carrera } from '@/lib/types';
import { fetchCarreras, createCarrera, updateCarrera } from '@/lib/api-client';

export function CarrerasDialog() {
  const [open, setOpen] = useState(false);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Formulario nueva carrera
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [facultad, setFacultad] = useState<'ING' | 'FCEA' | 'OTRA'>('ING');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await fetchCarreras(true);
      setCarreras(data || []);
    } catch {
      setMsg({ tipo: 'err', texto: 'No se pudo cargar la lista de carreras.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      cargar();
      setMsg(null);
      setShowAddForm(false);
    }
  }, [open]);

  const handleToggleActiva = async (c: Carrera) => {
    try {
      await updateCarrera(c.id, { activa: !c.activa });
      setCarreras((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, activa: !c.activa } : item))
      );
      setMsg({
        tipo: 'ok',
        texto: `Carrera ${c.codigo} ${!c.activa ? 'activada' : 'desactivada'} correctamente.`,
      });
    } catch {
      setMsg({ tipo: 'err', texto: 'Error al cambiar estado de la carrera.' });
    }
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCod = codigo.trim().toUpperCase();
    const cleanNom = nombre.trim();
    if (!cleanCod || !cleanNom) {
      setMsg({ tipo: 'err', texto: 'Código y nombre son obligatorios.' });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const nueva = await createCarrera({
        codigo: cleanCod,
        nombre: cleanNom,
        facultad,
        activa: true,
      });
      setCarreras((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setCodigo('');
      setNombre('');
      setShowAddForm(false);
      setMsg({ tipo: 'ok', texto: `¡Carrera ${cleanCod} creada exitosamente!` });
    } catch (err: any) {
      setMsg({ tipo: 'err', texto: err.message || 'Error al crear la carrera.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-green-700/30 text-green-800 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/50 flex items-center gap-2"
        >
          <GraduationCap className="w-4 h-4 text-green-700 dark:text-green-400" />
          <span>Gestionar Carreras</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-green-900 dark:text-green-300">
            <GraduationCap className="w-6 h-6 text-green-700 dark:text-green-400" />
            Oferta Académica ULSA
          </DialogTitle>
          <DialogDescription>
            Administra las carreras universitarias de la ULSA. Las carreras activas aparecen
            automáticamente en el registro de los estudiantes.
          </DialogDescription>
        </DialogHeader>

        {msg && (
          <div
            className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              msg.tipo === 'ok'
                ? 'bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-200 border border-green-300'
                : 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 border border-red-300'
            }`}
          >
            {msg.tipo === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{msg.texto}</span>
          </div>
        )}

        {/* Botón para alternar formulario de creación */}
        <div className="flex justify-between items-center my-2">
          <span className="text-sm font-semibold text-muted-foreground">
            {carreras.length} carreras registradas
          </span>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-[#123824] hover:bg-[#123824]/90 text-white flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Cerrar Formulario' : 'Nueva Carrera'}</span>
          </Button>
        </div>

        {/* Formulario de Alta de Carrera */}
        {showAddForm && (
          <form
            onSubmit={handleCrear}
            className="p-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 space-y-3 mb-4 animate-in fade-in-50"
          >
            <h4 className="font-semibold text-sm text-green-950 dark:text-green-200">
              Registrar Nueva Carrera Universitaria
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="nc-cod" className="text-xs">
                  Siglas / Código *
                </Label>
                <Input
                  id="nc-cod"
                  placeholder="Ej: ISW"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="mt-1"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="nc-nom" className="text-xs">
                  Nombre Oficial Completo *
                </Label>
                <Input
                  id="nc-nom"
                  placeholder="Ej: Ingeniería de Software"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-xs">Facultad</Label>
                <Select
                  value={facultad}
                  onValueChange={(v: 'ING' | 'FCEA' | 'OTRA') => setFacultad(v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ING">Facultad de Ingeniería</SelectItem>
                    <SelectItem value="FCEA">Facultad de Ciencias Económicas (FCEA)</SelectItem>
                    <SelectItem value="OTRA">Otra Facultad / Centro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="bg-green-700 hover:bg-green-800 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Carrera'
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Lista de Carreras */}
        {loading ? (
          <div className="flex justify-center items-center py-10 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-green-700" />
            <span>Cargando carreras...</span>
          </div>
        ) : (
          <div className="divide-y divide-border border rounded-xl overflow-hidden">
            {carreras.map((c) => (
              <div
                key={c.id || c.codigo}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/60 text-green-900 dark:text-green-200">
                      {c.codigo}
                    </span>
                    <span className="font-medium text-sm text-foreground truncate">
                      {c.nombre}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.facultad_display || (c.facultad === 'ING' ? 'Ingeniería' : 'FCEA')}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={c.activa ? 'outline' : 'secondary'}
                    onClick={() => handleToggleActiva(c)}
                    className={`text-xs h-7 px-2.5 ${
                      c.activa
                        ? 'border-green-600/40 text-green-800 dark:text-green-300'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {c.activa ? 'Activa' : 'Pausada'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
