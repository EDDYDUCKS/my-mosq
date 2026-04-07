import openpyxl
from django.contrib.auth import authenticate, get_user_model
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework import permissions
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

User = get_user_model()


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

class EstudianteViewSet(viewsets.ModelViewSet):
    queryset = Estudiante.objects.all()
    serializer_class = EstudianteSerializer
    permission_classes = [IsAdminUser]

class EquipoViewSet(viewsets.ModelViewSet):
    queryset = Equipo.objects.all()
    serializer_class = EquipoSerializer
    permission_classes = [IsAdminOrReadOnly]

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