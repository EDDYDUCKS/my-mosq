"""
Comando para procesar prestamos atrasados de forma automatica e idempotente.
Pensado para ejecutarse via Cron (ej. cada 15-30 minutos en Render) o CLI:
    python manage.py procesar_atrasados
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from usuarios.models import Prestamo, Sancion, BitacoraAccion


def ejecutar_procesamiento_atrasados(usuario_operador=None, ip_address=None):
    """
    Funcion reutilizable tanto por el management command como por la API REST.
    Busca prestamos en estado ACTIVO cuya fecha_devolucion haya vencido (fecha_devolucion < ahora),
    los pasa a estado ATRASADO, genera la sancion automatica y registra en auditoria.
    Retorna una tupla (contador, ids_procesados).
    """
    ahora = timezone.now()
    prestamos_vencidos = (
        Prestamo.objects
        .filter(estado='ACTIVO', fecha_devolucion__isnull=False, fecha_devolucion__lt=ahora)
        .select_related('estudiante')
    )

    procesados = []
    with transaction.atomic():
        for prestamo in prestamos_vencidos:
            prestamo.estado = 'ATRASADO'
            prestamo.save(update_fields=['estado'])

            # Crear sancion automatica idempotente si no existe una activa para este ticket
            motivo_texto = f'Devolución tardía automática del Ticket #{prestamo.id}'
            sancion_existente = Sancion.objects.filter(
                estudiante=prestamo.estudiante,
                activa=True,
                motivo=motivo_texto,
            ).exists()

            if not sancion_existente:
                Sancion.objects.create(
                    estudiante=prestamo.estudiante,
                    creada_por=usuario_operador,
                    motivo=motivo_texto,
                    observaciones='El sistema ha detectado que la fecha límite de devolución ha expirado.',
                    severidad='restriction',
                    activa=True,
                )

            # Registrar en bitacora de auditoria
            BitacoraAccion.objects.create(
                usuario=usuario_operador,
                accion='CREAR_SANCION',
                descripcion=(
                    f"Ticket #{prestamo.id} ({prestamo.estudiante.username}) marcado como ATRASADO automáticamente. "
                    f"Fecha esperada: {prestamo.fecha_devolucion.strftime('%Y-%m-%d %H:%M')}"
                ),
                ip_address=ip_address or '127.0.0.1 (cron/system)',
            )

            procesados.append(prestamo.id)

    return len(procesados), procesados


class Command(BaseCommand):
    help = 'Procesa prestamos activos vencidos, marcandolos como ATRASADO y generando sanciones.'

    def handle(self, *args, **options):
        self.stdout.write("Buscando prestamos activos vencidos...")
        total, ids = ejecutar_procesamiento_atrasados()
        if total > 0:
            self.stdout.write(self.style.SUCCESS(f"Se procesaron {total} prestamos atrasados exitosamente: {ids}"))
        else:
            self.stdout.write(self.style.SUCCESS("No se encontraron prestamos activos vencidos."))
