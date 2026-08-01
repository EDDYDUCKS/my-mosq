from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .inauguracion_reset import inauguracion_reset_view

# 1. El enrutador automático para tu CRUD (Crear, Leer, Actualizar, Borrar)
router = DefaultRouter()
router.register(r'estudiantes', views.EstudianteViewSet)
router.register(r'equipos', views.EquipoViewSet)
router.register(r'prestamos', views.PrestamoViewSet)
router.register(r'sanciones', views.SancionViewSet)
router.register(r'bitacora', views.BitacoraViewSet)

# 2. Las URLs finales que exponemos al mundo
urlpatterns = [
    path('auth/login/', views.LoginAPIView.as_view(), name='auth_login'),
    path('auth/google/', views.GoogleLoginView.as_view(), name='auth_google'),
    path('auth/completar-perfil/', views.CompletarPerfilView.as_view(), name='auth_completar_perfil'),
    path('auth/me/', views.CurrentUserAPIView.as_view(), name='auth_me'),

    # TEMPORAL: Limpiar imágenes rotas
    path('fix-images/', views.clear_broken_images_view, name='fix_images'),

    # TEMPORAL PRE-INAUGURACIÓN: Reset total (borrar tras usar)
    path('inauguracion-reset/', inauguracion_reset_view, name='inauguracion_reset'),

    # Incluimos todas las rutas automáticas (ej. /api/equipos/)
    path('', include(router.urls)),
    
    # NUEVA RUTA: El enlace directo para descargar el Excel
    path('reportes/excel/', views.exportar_reporte_excel, name='reporte_excel'),

    # NUEVA RUTA: Diagnóstico de IP
    path('my-ip/', views.my_ip, name='my_ip'),
]