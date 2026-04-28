import os
import django
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sgped_api.settings")
django.setup()

from usuarios.models import Estudiante

try:
    updated = Estudiante.objects.filter(is_staff=False, email__endswith='@est.ulsa.edu.ni').update(ano_cursado=None)
    print(f"SUCCESS: Updated {updated} students to None")
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(1)
