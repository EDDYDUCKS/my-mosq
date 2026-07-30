from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0013_equipo_cantidad_mantenimiento_bitacoraaccion'),
    ]

    operations = [
        migrations.AlterField(
            model_name='prestamo',
            name='estado',
            field=models.CharField(
                choices=[
                    ('PENDIENTE', 'Pendiente'),
                    ('ACTIVO', 'Activo'),
                    ('DEVUELTO', 'Devuelto'),
                    ('RECHAZADO', 'Rechazado'),
                    ('ATRASADO', 'Atrasado'),
                    ('PERDIDO', 'Perdido / Extraviado')
                ],
                default='PENDIENTE',
                max_length=20
            ),
        ),
    ]
