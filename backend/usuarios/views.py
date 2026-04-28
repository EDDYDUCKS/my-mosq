import openpyxl
from django.contrib.auth import authenticate, get_user_model
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework import permissions
from rest_framework import parsers
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.utils import timezone
from .models import Estudiante, Equipo, Prestamo, Sancion
from .serializers import EstudianteSerializer, EquipoSerializer, PrestamoSerializer, SancionSerializer
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from django.conf import settings

User = get_user_model()


# ── Lista blanca de cuentas administradoras ────────────────────────────────
def _get_admin_emails() -> set[str]:
    """
    Lee ADMIN_EMAILS del entorno y retorna un set de correos en minúsculas.
    Siempre incluye al superusuario 'admin' como salvaguarda.
    """
    raw = os.getenv('ADMIN_EMAILS', '')
    emails = {e.strip().lower() for e in raw.split(',') if e.strip()}
    return emails


def _sync_admin_flag(user) -> None:
    """
    - Si el correo del usuario está en la lista blanca → is_staff = True
    - Si NO está → is_staff = False (a menos que sea superusuario)
    Solo guarda si hubo cambio.
    """
    if user.is_superuser:
        return                          # nunca tocar al superusuario
    allowed = _get_admin_emails()
    should_be_staff = user.email.lower() in allowed
    if user.is_staff != should_be_staff:
        user.is_staff = should_be_staff
        user.save(update_fields=['is_staff'])


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


class LoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get('email') or request.data.get('username')
        password = request.data.get('password')

        if not identifier or not password:
            return Response({'detail': 'Email/usuario y contraseña son obligatorios.'}, status=400)

        username = identifier
        if '@' in identifier:
            user_by_email = User.objects.filter(email__iexact=identifier).first()
            if user_by_email:
                username = user_by_email.username

        user = authenticate(request, username=username, password=password)
        if not user:
            return Response({'detail': 'Credenciales inválidas.'}, status=401)

        # Sincronizar flag de admin con la lista blanca
        _sync_admin_flag(user)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': {
                'id': str(user.id),
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'role': 'admin' if (user.is_staff or user.is_superuser) else 'student',
            },
        })


class CurrentUserAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': str(user.id),
            'email': user.email,
            'name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'role': 'admin' if (user.is_staff or user.is_superuser) else 'student',
        })

# ==========================================
# 1. VISTAS AUTOMÁTICAS DE LA API (CRUD)
# ==========================================

from rest_framework import filters

class EstudianteViewSet(viewsets.ModelViewSet):
    queryset = Estudiante.objects.all()
    serializer_class = EstudianteSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'username', 'email', 'carnet']

class EquipoViewSet(viewsets.ModelViewSet):
    queryset = Equipo.objects.all()
    serializer_class = EquipoSerializer
    permission_classes = [IsAdminOrReadOnly]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

class PrestamoViewSet(viewsets.ModelViewSet):
    queryset = Prestamo.objects.all()
    serializer_class = PrestamoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Prestamo.objects.all().select_related('estudiante', 'entregado_por', 'recibido_por').prefetch_related('detalles__equipo')
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(estudiante=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.is_staff:
            estado = serializer.validated_data.get('estado')
            save_kwargs = {}
            if estado == 'ACTIVO':
                save_kwargs['entregado_por'] = self.request.user
            serializer.save(**save_kwargs)
            return

        estudiante = serializer.validated_data.get('estudiante')
        if not estudiante or estudiante.id != self.request.user.id:
            raise PermissionDenied('Solo puedes crear préstamos para tu propio usuario.')

        # Solo los estudiantes (@est.ulsa.edu.ni) deben tener carnet y carrera
        # Los profesores (@ac.ulsa.edu.ni) y staff (@ulsa.edu.ni) pueden prestar sin esos datos
        es_estudiante = self.request.user.email.lower().endswith('@est.ulsa.edu.ni')
        if es_estudiante and (not self.request.user.carnet or not self.request.user.carrera):
            raise PermissionDenied('Debes completar tu perfil (carnet y carrera) antes de solicitar equipos.')

        serializer.save(estado='PENDIENTE')

    def perform_update(self, serializer):
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            raise PermissionDenied('Solo administradores pueden actualizar préstamos.')

        estado_actual = serializer.instance.estado
        nuevo_estado = serializer.validated_data.get('estado', estado_actual)
        save_kwargs = {}

        if nuevo_estado == 'ACTIVO' and estado_actual != 'ACTIVO':
            save_kwargs['entregado_por'] = self.request.user

        if nuevo_estado == 'DEVUELTO' and estado_actual != 'DEVUELTO':
            save_kwargs['recibido_por'] = self.request.user
            save_kwargs['fecha_recepcion'] = timezone.now()
        elif estado_actual == 'DEVUELTO' and nuevo_estado != 'DEVUELTO':
            save_kwargs['recibido_por'] = None
            save_kwargs['fecha_recepcion'] = None

        serializer.save(**save_kwargs)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        """Permite al estudiante cancelar su propio préstamo PENDIENTE."""
        prestamo = self.get_object()
        
        # Solo el dueño puede cancelar
        if prestamo.estudiante != request.user:
            raise PermissionDenied('Solo puedes cancelar tus propios préstamos.')
        
        # Solo se pueden cancelar préstamos pendientes
        if prestamo.estado != 'PENDIENTE':
            return Response(
                {'detail': 'Solo se pueden cancelar préstamos en estado PENDIENTE.'},
                status=400
            )
        
        prestamo.estado = 'RECHAZADO'
        prestamo.save(update_fields=['estado'])
        
        return Response({'detail': 'Préstamo cancelado exitosamente.'})

    @action(detail=False, methods=['post'])
    def procesar_atrasados(self, request):
        if not request.user.is_staff:
            raise PermissionDenied('Solo administradores pueden procesar préstamos atrasados.')
            
        hoy = timezone.localdate()
        
        # Buscar préstamos ACTIVOS cuya fecha_devolucion (solo fecha) sea menor a hoy
        # Como fecha_devolucion es DateTimeField, comparamos su fecha.
        from django.db import transaction
        
        prestamos_atrasados = Prestamo.objects.filter(
            estado='ACTIVO', 
            fecha_devolucion__date__lt=hoy
        )
        
        contador = 0
        with transaction.atomic():
            for prestamo in prestamos_atrasados:
                prestamo.estado = 'ATRASADO'
                prestamo.save(update_fields=['estado'])
                
                # Crear la sanción automática
                from .models import Sancion
                Sancion.objects.create(
                    estudiante=prestamo.estudiante,
                    motivo=f'Devolución tardía automática del Ticket #{prestamo.id}',
                    observaciones='El sistema ha detectado que la fecha límite de devolución ha expirado.',
                    severidad='restriction',
                    activa=True
                )
                contador += 1
                
        return Response({'detail': f'Se procesaron {contador} préstamos atrasados.'})


class SancionViewSet(viewsets.ModelViewSet):
    queryset = Sancion.objects.all().select_related('estudiante', 'creada_por', 'resuelta_por')
    serializer_class = SancionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Sancion.objects.all().select_related('estudiante', 'creada_por', 'resuelta_por')
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(estudiante=self.request.user)

    def _ensure_admin(self):
        if not self.request.user.is_staff:
            raise PermissionDenied('Solo administradores pueden gestionar sanciones.')

    def perform_create(self, serializer):
        self._ensure_admin()
        serializer.save(creada_por=self.request.user)

    def perform_update(self, serializer):
        self._ensure_admin()
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_admin()
        instance.delete()

    @action(detail=True, methods=['patch'])
    def resolver(self, request, pk=None):
        self._ensure_admin()
        sancion = self.get_object()
        sancion.activa = False
        sancion.resuelta_por = request.user
        sancion.fecha_resolucion = timezone.now()

        observaciones = request.data.get('observaciones')
        if observaciones is not None:
            sancion.observaciones = observaciones

        sancion.save()
        return Response(self.get_serializer(sancion).data)


# ==========================================
# 2. GENERADOR DE REPORTES EXCEL (VERSIÓN CARRITO)
# ==========================================

@api_view(['GET'])
@permission_classes([IsAdminUser])
def exportar_reporte_excel(request):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Reporte de Préstamos"

    encabezados = [
        'Fecha de Entrega', 'Hora de Entrega', 'Fecha de Devolución', 'Hora de Devolución',
        'N° Carnet', 'Nombre del Estudiante', 'Carrera', 'Año', 
        'Descripción del Equipo', 'Cantidad', 'Entregado Por (Admin)', 'Recibido Por (Admin)'
    ]
    ws.append(encabezados)

    # Traemos los tickets con todos sus detalles de un solo golpe para no saturar la base de datos
    prestamos = Prestamo.objects.all().select_related('estudiante', 'entregado_por', 'recibido_por').prefetch_related('detalles__equipo')

    for p in prestamos:
        fecha_p = p.fecha_prestamo.strftime('%Y-%m-%d') if p.fecha_prestamo else 'N/A'
        hora_p = p.fecha_prestamo.strftime('%H:%M:%S') if p.fecha_prestamo else 'N/A'
        fecha_d = p.fecha_recepcion.strftime('%Y-%m-%d') if p.fecha_recepcion else 'Pendiente'
        hora_d = p.fecha_recepcion.strftime('%H:%M:%S') if p.fecha_recepcion else 'Pendiente'
        entregado_por = p.entregado_por.username if p.entregado_por else 'N/A'
        recibido_por = p.recibido_por.username if p.recibido_por else 'Pendiente'

        # MAGIA: Recorremos cada línea del carrito para este ticket
        for detalle in p.detalles.all():
            fila = [
                fecha_p,
                hora_p,
                fecha_d,
                hora_d,
                p.estudiante.carnet or 'Sin registro',
                f"{p.estudiante.first_name} {p.estudiante.last_name}",
                p.estudiante.carrera or 'Sin registro',
                p.estudiante.ano_cursado or 'Sin registro',
                detalle.equipo.nombre, # El nombre de lo que prestó
                detalle.cantidad,      # <--- ¡LA CANTIDAD REAL!
                entregado_por,
                recibido_por
            ]
            ws.append(fila)

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="Reporte_Mensual_SGPED.xlsx"'
    
    wb.save(response)
    return response


# ==========================================
# 3. GOOGLE LOGIN Y PERFIL
# ==========================================

class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token_google = request.data.get('credential')
        if not token_google:
            return Response({'detail': 'Token no proporcionado.'}, status=400)

        try:
            # Validar el token con Google permitiendo un pequeño desfase de reloj (clock skew)
            client_id = getattr(settings, 'GOOGLE_CLIENT_ID', os.getenv('GOOGLE_CLIENT_ID', ''))
            idinfo = id_token.verify_oauth2_token(
                token_google, 
                google_requests.Request(), 
                client_id,
                clock_skew_in_seconds=15
            )

            email = idinfo.get('email', '')
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')

            # Verificar dominios permitidos
            dominios_permitidos = ['@est.ulsa.edu.ni', '@ulsa.edu.ni', '@ac.ulsa.edu.ni']
            if not any(email.endswith(dominio) for dominio in dominios_permitidos):
                return Response({'detail': 'Dominio no autorizado. Usa tu correo de la universidad.'}, status=403)

            # Buscar o crear usuario
            user, created = User.objects.get_or_create(username=email, defaults={
                'email': email,
                'first_name': first_name,
                'last_name': last_name
            })

            # Sincronizar flag de admin con la lista blanca
            _sync_admin_flag(user)

            # Generar token DRF
            token, _ = Token.objects.get_or_create(user=user)

            # Verificar si necesita completar perfil (solo estudiantes)
            requiere_perfil = False
            if not user.is_staff and not user.is_superuser:
                if email.endswith('@est.ulsa.edu.ni'):
                    if not user.carnet or not user.carrera or not user.ano_cursado:
                        requiere_perfil = True

            return Response({
                'token': token.key,
                'requiere_completar_perfil': requiere_perfil,
                'user': {
                    'id': str(user.id),
                    'email': user.email,
                    'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                    'role': 'admin' if (user.is_staff or user.is_superuser) else 'student',
                }
            })

        except ValueError as e:
            print(f"Error de Google Auth: {str(e)}")
            return Response({'detail': f'Token inválido: {str(e)}'}, status=401)


import re

class CompletarPerfilView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        carnet = request.data.get('carnet')
        carrera = request.data.get('carrera')
        ano_cursado = request.data.get('ano_cursado')

        if not carnet or not carrera or not ano_cursado:
            return Response({'detail': 'Carnet, carrera y año cursado son obligatorios.'}, status=400)

        carnet_regex = r'^\d{2}-[a-zA-Z0-9\-]{5,}$'
        if not re.match(carnet_regex, carnet):
            return Response({'detail': 'El formato del carnet es inválido.'}, status=400)

        valid_anos = ['1', '2', '3', '4', '5']
        if str(ano_cursado) not in valid_anos:
            return Response({'detail': 'El año cursado debe ser entre 1 y 5.'}, status=400)

        user.carnet = carnet
        user.carrera = carrera
        user.ano_cursado = str(ano_cursado)
        user.save(update_fields=['carnet', 'carrera', 'ano_cursado'])

        return Response({'detail': 'Perfil actualizado correctamente.'})