"""
Servicio centralizado para gestion atomica del inventario y control de disponibilidad.
Evita condiciones de carrera (race conditions) y sobre-reserva (overbooking)
utilizando transacciones atomicas y bloqueos de fila con select_for_update().
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F, Sum


def recalcular_disponibilidad_equipo(equipo_id: int) -> int:
    """
    Recalcula la cantidad disponible real de un equipo considerando:
    cantidad_total - cantidad_mantenimiento - prestados_en_tickets_activos.
    """
    from usuarios.models import Equipo, DetallePrestamo

    with transaction.atomic():
        equipo = Equipo.objects.select_for_update().get(pk=equipo_id)
        prestados_activos = (
            DetallePrestamo.objects
            .filter(prestamo__estado__in=['ACTIVO', 'ATRASADO'], equipo=equipo)
            .aggregate(total=Sum('cantidad'))['total'] or 0
        )
        nueva_disponible = max(0, equipo.cantidad_total - equipo.cantidad_mantenimiento - prestados_activos)
        if equipo.cantidad_disponible != nueva_disponible:
            equipo.cantidad_disponible = nueva_disponible
            equipo.save(update_fields=['cantidad_disponible'])
        return nueva_disponible


def validar_disponibilidad_para_prestamo(detalles_items) -> None:
    """
    Verifica que haya suficiente stock disponible de todos los equipos requeridos
    antes de activar un prestamo. Lanza ValidationError si falta disponibilidad.
    """
    from usuarios.models import Equipo

    with transaction.atomic():
        for item in detalles_items:
            eq_pk = item.equipo.pk if hasattr(item, 'equipo') else item['equipo']
            cant_requerida = item.cantidad if hasattr(item, 'cantidad') else item['cantidad']
            disp = recalcular_disponibilidad_equipo(eq_pk)
            if disp < cant_requerida:
                equipo = Equipo.objects.get(pk=eq_pk)
                raise ValidationError(
                    f"No hay suficiente stock disponible de '{equipo.nombre}' "
                    f"(Quedan {disp} disponibles, solicita {cant_requerida})."
                )


def descontar_stock_prestamo(detalles_qs) -> None:
    """
    Descuenta de forma atomica las unidades de los equipos especificados.
    """
    from usuarios.models import Equipo

    with transaction.atomic():
        for detalle in detalles_qs:
            equipo = Equipo.objects.select_for_update().get(pk=detalle.equipo.pk)
            if equipo.cantidad_disponible >= detalle.cantidad:
                equipo.cantidad_disponible = F('cantidad_disponible') - detalle.cantidad
                equipo.save(update_fields=['cantidad_disponible'])
            else:
                raise ValidationError(f"Stock insuficiente de '{equipo.nombre}' para completar la entrega.")


def restaurar_stock_prestamo(detalles_qs, a_mantenimiento: bool = False) -> None:
    """
    Restaura al inventario de bodega las unidades de los equipos que estaban prestados.
    Si a_mantenimiento=True, las unidades se trasladan a cantidad_mantenimiento en vez de disponible.
    """
    from usuarios.models import Equipo

    with transaction.atomic():
        for detalle in detalles_qs:
            equipo = Equipo.objects.select_for_update().get(pk=detalle.equipo.pk)
            if a_mantenimiento:
                equipo.cantidad_mantenimiento = F('cantidad_mantenimiento') + detalle.cantidad
                equipo.save(update_fields=['cantidad_mantenimiento'])
                # Recalcula disponibilidad real garantizando sincronización
                recalcular_disponibilidad_equipo(equipo.pk)
            else:
                equipo.cantidad_disponible = F('cantidad_disponible') + detalle.cantidad
                equipo.save(update_fields=['cantidad_disponible'])

