import json
from django.http import JsonResponse
from django.db import transaction
from usuarios.models import Prestamo, BitacoraAccion, Equipo

SECRET_TOKEN = 'MOSQ_RESET_FINAL_2026'

def inauguracion_reset_view(request):
    token = request.GET.get('token', '')
    if token != SECRET_TOKEN:
        return JsonResponse({'error': 'Token inválido. Acceso denegado.'}, status=403)

    try:
        with transaction.atomic():
            p_deleted = Prestamo.objects.count()
            Prestamo.objects.all().delete()

            b_deleted = BitacoraAccion.objects.count()
            BitacoraAccion.objects.all().delete()

            equipos = Equipo.objects.all()
            for eq in equipos:
                eq.recalcular_disponibilidad()

        return JsonResponse({
            'status': 'ok',
            'mensaje': '🎉 Limpieza total completada. Préstamos y Bitácora reseteados a 0.',
            'detalle': {
                'prestamos_borrados': p_deleted,
                'bitacora_borrada': b_deleted,
                'equipos_recalculados': equipos.count()
            }
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'mensaje': str(e)}, status=500)
