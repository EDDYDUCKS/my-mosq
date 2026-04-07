from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0007_sancion'),
    ]

    operations = [
        migrations.AddField(
            model_name='prestamo',
            name='fecha_recepcion',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='prestamo',
            name='recibido_por',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='prestamos_recibidos_en_bodega', to=settings.AUTH_USER_MODEL),
        ),
    ]