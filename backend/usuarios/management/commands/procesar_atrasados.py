"""
Comando para procesar prestamos atrasados y recordatorios preventivos de forma automatica e idempotente.
Pensado para ejecutarse via Cron (ej. cada 15-30 minutos en Render) o CLI:
    python manage.py procesar_atrasados
"""

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from usuarios.models import Prestamo, Sancion, BitacoraAccion
from usuarios.utils import enviar_notificacion_email


def ejecutar_recordatorios_preventivos():
    """
    Envia recordatorios preventivos a prestamos activos que vencen en las proximas 2 horas.
    Retorna la cantidad de recordatorios enviados.
    """
    ahora = timezone.now()
    limite_recordatorio = ahora + timedelta(hours=2)
    prestamos_proximos = (
        Prestamo.objects
        .filter(
            estado='ACTIVO',
            fecha_devolucion__isnull=False,
            fecha_devolucion__gte=ahora,
            fecha_devolucion__lte=limite_recordatorio,
            recordatorio_enviado=False
        )
        .select_related('estudiante')
    )

    recordatorios_enviados = []
    for prestamo in prestamos_proximos:
        if prestamo.estudiante and prestamo.estudiante.email:
            hora_str = prestamo.fecha_devolucion.strftime('%H:%M')
            enviar_notificacion_email(
                destinatario_email=prestamo.estudiante.email,
                asunto=f"[RECORDATORIO] Tu préstamo #{prestamo.id} vence hoy - ULSA",
                mensaje_texto=(
                    f"Hola {prestamo.estudiante.first_name or prestamo.estudiante.username},\n\n"
                    f"Te recordamos que tu préstamo #{prestamo.id} tiene como hora límite de devolución "
                    f"hoy a las {hora_str}.\n"
                    f"Por favor entrégalo a tiempo en la bodega para evitar sanciones en tu cuenta.\n\n"
                    f"Bienestar Estudiantil ULSA"
                )
            )
        prestamo.recordatorio_enviado = True
        prestamo.save(update_fields=['recordatorio_enviado'])
        recordatorios_enviados.append(prestamo.id)

    return len(recordatorios_enviados)


def ejecutar_procesamiento_atrasados(usuario_operador=None, ip_address=None):
    """
    Funcion reutilizable tanto por el management command como por la API REST.
    1. Busca prestamos en estado ACTIVO cuya fecha_devolucion haya vencido (fecha_devolucion < ahora),
       los pasa a estado ATRASADO, genera la sancion automatica y registra en auditoria.
    2. Envia recordatorios preventivos a prestamos activos que vencen en las proximas 2 horas.
    Retorna una tupla (contador_atrasados, ids_atrasados).
    """
    ahora = timezone.now()

    # 1. Procesar atrasados
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

            # Notificar al estudiante por correo
            if prestamo.estudiante and prestamo.estudiante.email:
                enviar_notificacion_email(
                    destinatario_email=prestamo.estudiante.email,
                    asunto=f"[ATENCIÓN] Préstamo #{prestamo.id} Vencido y Atrasado - ULSA",
                    mensaje_texto=(
                        f"Hola {prestamo.estudiante.first_name or prestamo.estudiante.username},\n\n"
                        f"Tu préstamo #{prestamo.id} ha excedido la hora límite de entrega y ha sido marcado como ATRASADO.\n"
                        f"Se ha registrado una restricción temporal en tu cuenta. Por favor acude de inmediato a la bodega a devolver los equipos.\n\n"
                        f"Bienestar Estudiantil ULSA"
                    )
                )

            procesados.append(prestamo.id)

    # 2. Disparar recordatorios preventivos
    ejecutar_recordatorios_preventivos()

    return len(procesados), procesados


class Command(BaseCommand):
    help = 'Procesa prestamos activos vencidos (marcandolos como ATRASADO) y envia recordatorios preventivos.'

    def handle(self, *args, **options):
        self.stdout.write("Buscando prestamos activos vencidos y proximos a vencer...")
        total_atrasados, ids = ejecutar_procesamiento_atrasados()
        if total_atrasados > 0:
            self.stdout.write(self.style.SUCCESS(f"Se procesaron {total_atrasados} prestamos atrasados: {ids}"))
        else:
            self.stdout.write(self.style.SUCCESS("No se encontraron prestamos activos vencidos."))
