"""
Comando de limpieza para la inauguración del sistema.

Uso:
    python manage.py reset_loans

Qué hace:
    1. Borra TODOS los préstamos (y sus detalles en cascada)
    2. Resetea la secuencia de IDs de PostgreSQL a 1 (próximo ticket = #1)
    3. Recalcula el stock disponible de todos los equipos

Qué NO toca:
    - Equipos (Equipo)
    - Usuarios / Estudiantes
    - Sanciones
    - Bitácora de auditoría
    - Imágenes

ADVERTENCIA: Esta operación es IRREVERSIBLE.
             Úsala solo una vez antes de la inauguración.
"""

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from usuarios.models import Prestamo, Equipo


class Command(BaseCommand):
    help = 'Limpia todo el historial de préstamos y reinicia el contador de IDs a 1.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirmar',
            action='store_true',
            help='Confirma que deseas borrar todo el historial de préstamos.',
        )

    def handle(self, *args, **options):
        if not options['confirmar']:
            self.stdout.write(self.style.WARNING(
                '\n⚠️  ADVERTENCIA: Este comando borrará TODOS los préstamos de forma permanente.\n'
                '   Para confirmar, ejecuta:\n\n'
                '       python manage.py reset_loans --confirmar\n'
            ))
            return

        self.stdout.write('\n🚀 Iniciando limpieza de historial de préstamos...\n')

        with transaction.atomic():

            # ── 1. Borrar todos los préstamos ────────────────────────────────
            # DetallePrestamo se borra en cascada automáticamente
            total = Prestamo.objects.count()
            Prestamo.objects.all().delete()
            self.stdout.write(self.style.SUCCESS(
                f'  ✅ {total} préstamo(s) eliminados (incluyendo sus detalles).'
            ))

            # ── 2. Resetear secuencia de IDs a 1 (PostgreSQL) ────────────────
            # Esto hace que el próximo ticket creado tenga ID = 1
            with connection.cursor() as cursor:
                try:
                    cursor.execute(
                        "SELECT setval(pg_get_serial_sequence('usuarios_prestamo', 'id'), 1, false);"
                    )
                    self.stdout.write(self.style.SUCCESS(
                        '  ✅ Secuencia de IDs reseteada — el próximo ticket será el #1.'
                    ))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(
                        f'  ⚠️  No se pudo resetear la secuencia automáticamente: {e}\n'
                        '      Los IDs seguirán desde el último número usado.'
                    ))

            # ── 3. Recalcular stock disponible de todos los equipos ──────────
            # Sin préstamos activos, todo el stock vuelve a estar disponible
            equipos = Equipo.objects.all()
            for equipo in equipos:
                equipo.recalcular_disponibilidad()

            self.stdout.write(self.style.SUCCESS(
                f'  ✅ Stock recalculado para {equipos.count()} equipo(s).'
            ))

        self.stdout.write(self.style.SUCCESS(
            '\n🎉 Limpieza completada. El sistema está listo para la inauguración.\n'
            '   El próximo préstamo creado será el Ticket #1.\n'
        ))
