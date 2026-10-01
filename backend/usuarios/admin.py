from django.contrib import admin
from .models import Estudiante, Equipo, Prestamo, DetallePrestamo, Sancion, BitacoraAccion


@admin.register(Estudiante)
class EstudianteAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'carnet', 'carrera', 'ano_cursado', 'sancionado', 'is_staff')
    list_filter = ('sancionado', 'carrera', 'is_staff')
    search_fields = ('username', 'email', 'carnet', 'first_name', 'last_name')
    ordering = ('username',)


@admin.register(Equipo)
class EquipoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'marca_modelo', 'color', 'cantidad_total', 'cantidad_disponible', 'cantidad_mantenimiento')
    search_fields = ('nombre', 'marca_modelo', 'color')
    list_filter = ('marca_modelo',)


class DetallePrestamoInline(admin.TabularInline):
    model = DetallePrestamo
    extra = 0


@admin.register(DetallePrestamo)
class DetallePrestamoAdmin(admin.ModelAdmin):
    list_display = ('id', 'prestamo', 'equipo', 'cantidad')
    list_filter = ('equipo',)
    search_fields = ('prestamo__id', 'equipo__nombre')
    ordering = ('-prestamo__id',)


@admin.register(Prestamo)
class PrestamoAdmin(admin.ModelAdmin):
    list_display = ('id', 'estudiante', 'estado', 'fecha_prestamo', 'fecha_devolucion', 'entregado_por', 'recibido_por')
    list_filter = ('estado', 'fecha_prestamo')
    search_fields = ('id', 'estudiante__username', 'estudiante__email', 'solicitante_externo')
    inlines = [DetallePrestamoInline]
    ordering = ('-fecha_prestamo', '-id')


@admin.register(Sancion)
class SancionAdmin(admin.ModelAdmin):
    list_display = ('id', 'estudiante', 'severidad', 'activa', 'fecha_inicio', 'fecha_fin', 'creada_por')
    list_filter = ('activa', 'severidad')
    search_fields = ('estudiante__username', 'motivo')
    ordering = ('-fecha_inicio', '-id')


@admin.register(BitacoraAccion)
class BitacoraAccionAdmin(admin.ModelAdmin):
    list_display = ('id', 'usuario', 'accion', 'fecha_hora', 'ip_address')
    list_filter = ('accion', 'fecha_hora')
    search_fields = ('descripcion', 'usuario__username', 'ip_address')
    ordering = ('-fecha_hora', '-id')