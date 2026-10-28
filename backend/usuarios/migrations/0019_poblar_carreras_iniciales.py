from django.db import migrations

def poblar_carreras(apps, schema_editor):
    Carrera = apps.get_model('usuarios', 'Carrera')
    carreras_iniciales = [
        ('LAF', 'Licenciatura Administrativa con Énfasis en Finanzas', 'FCEA'),
        ('LCM', 'Licenciatura Comercial con Énfasis en Mercadeo', 'FCEA'),
        ('IGI', 'Ingeniería en Gestión Industrial', 'ING'),
        ('ICE', 'Ingeniería Cibernética Electrónica', 'ING'),
        ('IME', 'Ingeniería Mecánica y Energías Renovables', 'ING'),
        ('IMS', 'Ingeniería Mecatrónica y Sistemas de Control', 'ING'),
        ('IEM', 'Ingeniería Electromédica', 'ING'),
    ]
    for codigo, nombre, facultad in carreras_iniciales:
        Carrera.objects.get_or_create(
            codigo=codigo,
            defaults={'nombre': nombre, 'facultad': facultad, 'activa': True}
        )

def revertir_poblar(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('usuarios', '0018_carrera_alter_bitacoraaccion_accion_and_more'),
    ]
    operations = [
        migrations.RunPython(poblar_carreras, revertir_poblar),
    ]
