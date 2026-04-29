from django.db import models
from django.core.exceptions import ValidationError
from django.db.models import F
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from django.db import transaction

# --- MODELO ESTUDIANTE ---
class Estudiante(AbstractUser):
    CARRERAS_ULSA = [
        ('LAF', 'Licenciatura Administrativa con Énfasis en Finanzas'),
        ('LCM', 'Licenciatura Comercial con Énfasis en Mercadeo'),
        ('IGI', 'Ingeniería en Gestión Industrial'),
        ('ICE', 'Ingeniería Cibernética Electrónica'),
        ('IME', 'Ingeniería Mecánica y Energías Renovables'),
        ('IMS', 'Ingeniería Mecatrónica y Sistemas de Control'),
        ('IEM', 'Ingeniería Electromédica'),
    ]
    carnet = models.CharField(max_length=20, null=True, blank=True)
    carrera = models.CharField(max_length=5, choices=CARRERAS_ULSA, null=True, blank=True)
    ano_cursado = models.CharField(max_length=20, null=True, blank=True)
    sancionado = models.BooleanField(default=False)

    def actualizar_estado_sancion(self):
        hoy = timezone.localdate()
        tiene_sancion_vigente = self.sanciones.filter(activa=True).filter(
            models.Q(fecha_fin__isnull=True) | models.Q(fecha_fin__gte=hoy)
        ).exists()

        if self.sancionado != tiene_sancion_vigente:
            self.sancionado = tiene_sancion_vigente
            self.save(update_fields=['sancionado'])

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.username})"

# --- MODELO EQUIPO ---
class Equipo(models.Model):
    nombre = models.CharField(max_length=100)
    marca_modelo = models.CharField(max_length=150, blank=True, null=True, help_text='Marca, modelo o numeración (Ej: MOLTEN F523 #5)')
    color = models.CharField(max_length=100, blank=True, null=True)
    descripcion = models.TextField(blank=True, null=True)
    imagen = models.ImageField(upload_to='equipos/', blank=True, null=True)
    cantidad_total = models.PositiveIntegerField(default=1)
    cantidad_disponible = models.PositiveIntegerField(default=1)

    def __str__(self):
        return self.nombre

# --- MODELO PRESTAMO (EL TICKET GENERAL) ---
class Prestamo(models.Model):
    ESTADOS_PRESTAMO = [
        ('PENDIENTE', 'Pendiente'),
        ('ACTIVO', 'Activo'),
        ('DEVUELTO', 'Devuelto'),
        ('RECHAZADO', 'Rechazado'),
        ('ATRASADO', 'Atrasado'),
    ]
    estudiante = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='prestamos_recibidos')
    entregado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='prestamos_entregados')
    recibido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='prestamos_recibidos_en_bodega')
    fecha_prestamo = models.DateTimeField(auto_now_add=True)
    fecha_devolucion = models.DateTimeField(null=True, blank=True)
    fecha_recepcion = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADOS_PRESTAMO, default='PENDIENTE')
    solicitante_externo = models.CharField(max_length=150, null=True, blank=True, help_text='Nombre del solicitante externo (entrenador, etc.)')
    observaciones = models.TextField(blank=True, null=True, help_text='Notas adicionales sobre el préstamo')

    def __str__(self):
        nombre = self.solicitante_externo or self.estudiante.username
        return f"Ticket #{self.id} - {nombre}"

    def save(self, *args, **kwargs):
        # 1. Bloqueos de Seguridad
        if self.estado == 'ACTIVO':
            self.estudiante.actualizar_estado_sancion()
            self.estudiante.refresh_from_db(fields=['sancionado'])
            if self.estudiante.sancionado:
                raise ValidationError(f"¡Bloqueado! {self.estudiante.username} está sancionado.")
            if not self.estudiante.carnet or not self.estudiante.carrera:
                raise ValidationError("¡Perfil incompleto! Se requiere carnet y carrera.")
            
            # Solo permitimos 1 ticket activo a la vez por estudiante
            prestamos_activos = Prestamo.objects.filter(
                estudiante=self.estudiante, estado='ACTIVO'
            ).exclude(pk=self.pk)
            if prestamos_activos.exists():
                raise ValidationError(f"¡Bloqueado! {self.estudiante.username} ya tiene un carrito sin devolver.")

        # 2. Devolución automática al inventario cuando todo el ticket cambia a DEVUELTO
        if self.pk:
            viejo_prestamo = Prestamo.objects.get(pk=self.pk)
            if viejo_prestamo.estado == 'ACTIVO' and self.estado != 'ACTIVO':
                with transaction.atomic():
                    for detalle in self.detalles.all():
                        equipo = Equipo.objects.select_for_update().get(pk=detalle.equipo.pk)
                        equipo.cantidad_disponible = F('cantidad_disponible') + detalle.cantidad
                        equipo.save(update_fields=['cantidad_disponible'])
            
            # Reactivar un ticket devuelto (resta otra vez)
            elif viejo_prestamo.estado != 'ACTIVO' and self.estado == 'ACTIVO':
                with transaction.atomic():
                    for detalle in self.detalles.all():
                        equipo = Equipo.objects.select_for_update().get(pk=detalle.equipo.pk)
                        if equipo.cantidad_disponible >= detalle.cantidad:
                            equipo.cantidad_disponible = F('cantidad_disponible') - detalle.cantidad
                            equipo.save(update_fields=['cantidad_disponible'])
                        else:
                            raise ValidationError(f"¡Faltan '{equipo.nombre}' en bodega para reactivar!")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Si borramos el ticket entero, regresamos todo a la bodega
        if self.estado == 'ACTIVO':
            with transaction.atomic():
                for detalle in self.detalles.all():
                    equipo = Equipo.objects.select_for_update().get(pk=detalle.equipo.pk)
                    equipo.cantidad_disponible = F('cantidad_disponible') + detalle.cantidad
                    equipo.save(update_fields=['cantidad_disponible'])
        super().delete(*args, **kwargs)

# --- NUEVO: MODELO DETALLE_PRESTAMO (LAS LÍNEAS DEL CARRITO) ---
class DetallePrestamo(models.Model):
    prestamo = models.ForeignKey(Prestamo, on_delete=models.CASCADE, related_name='detalles')
    equipo = models.ForeignKey(Equipo, on_delete=models.CASCADE)
    cantidad = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.cantidad} x {self.equipo.nombre}"

    def save(self, *args, **kwargs):
        # Cuando se agrega un equipo al carrito, se resta de la bodega
        if not self.pk and self.prestamo.estado == 'ACTIVO':
            with transaction.atomic():
                equipo = Equipo.objects.select_for_update().get(pk=self.equipo.pk)
                if equipo.cantidad_disponible >= self.cantidad:
                    equipo.cantidad_disponible = F('cantidad_disponible') - self.cantidad
                    equipo.save(update_fields=['cantidad_disponible'])
                else:
                    raise ValidationError(f"¡Solo hay {equipo.cantidad_disponible} '{equipo.nombre}' disponibles!")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Si quitan un equipo del carrito, lo devolvemos a la bodega
        if self.prestamo.estado == 'ACTIVO':
            with transaction.atomic():
                equipo = Equipo.objects.select_for_update().get(pk=self.equipo.pk)
                equipo.cantidad_disponible = F('cantidad_disponible') + self.cantidad
                equipo.save(update_fields=['cantidad_disponible'])
        super().delete(*args, **kwargs)


class Sancion(models.Model):
    SEVERIDAD_CHOICES = [
        ('warning', 'Advertencia'),
        ('restriction', 'Restricción'),
        ('ban', 'Prohibición'),
    ]

    estudiante = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sanciones')
    creada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sanciones_creadas',
    )
    resuelta_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sanciones_resueltas',
    )
    motivo = models.TextField()
    observaciones = models.TextField(null=True, blank=True)
    severidad = models.CharField(max_length=20, choices=SEVERIDAD_CHOICES)
    fecha_inicio = models.DateField(default=timezone.localdate)
    fecha_fin = models.DateField(null=True, blank=True)
    activa = models.BooleanField(default=True)
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_inicio', '-id']

    def __str__(self):
        return f"Sanción #{self.id} - {self.estudiante.username}"

    def clean(self):
        if self.fecha_fin and self.fecha_fin < self.fecha_inicio:
            raise ValidationError('La fecha de fin no puede ser menor a la fecha de inicio.')

    def save(self, *args, **kwargs):
        self.full_clean()
        if not self.activa and self.fecha_resolucion is None:
            self.fecha_resolucion = timezone.now()

        super().save(*args, **kwargs)
        self.estudiante.actualizar_estado_sancion()

    def delete(self, *args, **kwargs):
        estudiante = self.estudiante
        super().delete(*args, **kwargs)
        estudiante.actualizar_estado_sancion()