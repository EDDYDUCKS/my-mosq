from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0014_alter_prestamo_estado'),
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
                    ('RECHAZADO', 'Rechazado por Bodega'),
                    ('CANCELADO', 'Cancelado por Estudiante'),
                    ('ATRASADO', 'Atrasado'),
                    ('PERDIDO', 'Perdido / Extraviado')
                ],
                default='PENDIENTE',
                max_length=20
            ),
        ),
    ]
