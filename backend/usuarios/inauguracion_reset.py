"""
Endpoint temporal de limpieza pre-inauguración.

INSTRUCCIONES DE USO:
1. Haz GET a:
   https://<tu-backend>.onrender.com/api/inauguracion-reset/?token=MOSQ_RESET_2026

2. Verás la respuesta JSON con el resultado.

3. Después de ejecutarlo exitosamente, elimina este archivo y quita
   la URL de usuarios/urls.py y vuelve a hacer push.
"""

import json
from django.http import JsonResponse
from django.db import connection, transaction
from usuarios.models import Prestamo, Equipo

# Token secreto — cámbialo si quieres mayor seguridad
SECRET_TOKEN = 'MOSQ_RESET_2026'


def inauguracion_reset_view(request):
    """Vista temporal de un solo uso para limpiar el historial de préstamos."""

    # ── Validar token ────────────────────────────────────────────────────────
    token = request.GET.get('token', '')
    if token != SECRET_TOKEN:
        return JsonResponse(
            {'error': 'Token inválido. Acceso denegado.'},
            status=403
        )

    resultados = {}

    try:
        with transaction.atomic():

            # ── 1. Contar y borrar todos los préstamos ───────────────────────
            total_prestamos = Prestamo.objects.count()
            Prestamo.objects.all().delete()
            resultados['prestamos_borrados'] = total_prestamos

            # ── 2. Resetear secuencia de IDs a 1 (PostgreSQL) ────────────────
            with connection.cursor() as cursor:
                try:
                    cursor.execute(
                        "SELECT setval(pg_get_serial_sequence('usuarios_prestamo', 'id'), 1, false);"
                    )
                    resultados['id_reseteado'] = True
                    resultados['proximo_ticket'] = '#1'
                except Exception as e:
                    resultados['id_reseteado'] = False
                    resultados['id_reset_error'] = str(e)

            # ── 3. Recalcular stock disponible de todos los equipos ──────────
            equipos = Equipo.objects.all()
            for equipo in equipos:
                equipo.recalcular_disponibilidad()
            resultados['equipos_recalculados'] = equipos.count()

        return JsonResponse({
            'status': 'ok',
            'mensaje': '🎉 Limpieza completada. El sistema está listo para la inauguración.',
            'detalle': resultados,
        })

    except Exception as e:
        return JsonResponse(
            {'status': 'error', 'mensaje': str(e)},
            status=500
        )
