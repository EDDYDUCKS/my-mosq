from django.contrib import admin
from django.urls import path, include # <-- Ojo con agregar 'include' aquí
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # Conectamos las URLs de nuestra API para que entren por /api/
    path('api/', include('usuarios.urls')), 
]

# Permitir que Django sirva archivos multimedia (imágenes) en producción
from django.urls import re_path
from django.views.static import serve

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {
        'document_root': settings.MEDIA_ROOT,
    }),
]