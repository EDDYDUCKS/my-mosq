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
        
        # Check if student needs to complete profile
        requiere_perfil = False
        if not user.is_staff and not user.is_superuser:
            if user.email and user.email.endswith('@est.ulsa.edu.ni'):
                if not user.carnet or not user.carrera or not user.ano_cursado:
                    requiere_perfil = True
        
        return Response({
            'id': str(user.id),
            'email': user.email,
            'name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'role': 'admin' if (user.is_staff or user.is_superuser) else 'student',
            'requiere_completar_perfil': requiere_perfil,
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
        queryset = (
            Prestamo.objects.all()
            .select_related('estudiante', 'entregado_por', 'recibido_por')
            .prefetch_related('detalles__equipo')
            .order_by('-fecha_prestamo', '-id')
        )
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(estudiante=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.is_staff:
            estado = serializer.validated_data.get('estado')
            save_kwargs = {}
            if estado == 'ACTIVO':
                save_kwargs['entregado_por'] = self.request.user
            
            # Check sanction if assigning to a student
            estudiante = serializer.validated_data.get('estudiante')
            if estudiante and estudiante.sancionado:
                raise PermissionDenied(f'El estudiante {estudiante.first_name} tiene una sanción activa y no puede recibir préstamos.')
                
            serializer.save(**save_kwargs)
            return

        estudiante = serializer.validated_data.get('estudiante')
        if not estudiante or estudiante.id != self.request.user.id:
            raise PermissionDenied('Solo puedes crear préstamos para tu propio usuario.')

        if self.request.user.sancionado:
            raise PermissionDenied('No puedes solicitar préstamos porque tienes una sanción activa.')

        # Solo los estudiantes (@est.ulsa.edu.ni) deben tener carnet y carrera
        # Los profesores (@ac.ulsa.edu.ni) y staff (@ulsa.edu.ni) pueden prestar sin esos datos
        es_estudiante = self.request.user.email.lower().endswith('@est.ulsa.edu.ni')
        if es_estudiante and (not self.request.user.carnet or not self.request.user.carrera):
            raise PermissionDenied('Debes completar tu perfil (carnet y carrera) antes de solicitar equipos.')

        serializer.save(estado='PENDIENTE')

    def perform_update(self, serializer):
        estado_actual = serializer.instance.estado
        nuevo_estado = self.request.data.get('estado', estado_actual)

        # Permitir a estudiantes cancelar sus propios préstamos pendientes
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            if (serializer.instance.estudiante == self.request.user
                    and estado_actual == 'PENDIENTE'
                    and nuevo_estado == 'RECHAZADO'):
                serializer.instance.estado = 'RECHAZADO'
                serializer.instance.save(update_fields=['estado'])
                return
            raise PermissionDenied('Solo administradores pueden actualizar préstamos.')

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
    import calendar
    import logging
    from datetime import datetime as dt
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    logger = logging.getLogger(__name__)

    try:
        # ── Colores institucionales ULSA ──────────────────────────────────────
        COLOR_ULSA        = '27822e'   # verde ULSA (fondo titulo y encabezados)
        COLOR_HEADER_TEXT = 'FFFFFF'   # blanco para texto de encabezados
        COLOR_FILA_PAR    = 'F0F7F0'   # verde muy claro para filas pares
        COLOR_FILA_IMPAR  = 'FFFFFF'   # blanco para filas impares
        # Colores por estado
        COLOR_DEVUELTO    = 'C8E6C9'
        COLOR_PENDIENTE   = 'FFF9C4'
        COLOR_ATRASADO    = 'FFCDD2'
        COLOR_RECHAZADO   = 'EEEEEE'

        # ── Filtro por mes (parámetro ?mes=2026-07) ───────────────────────────
        mes_param = request.GET.get('mes', None)
        hoy = timezone.localtime(timezone.now())
        if mes_param:
            try:
                anio, mes_num = map(int, mes_param.split('-'))
            except (ValueError, AttributeError):
                anio, mes_num = hoy.year, hoy.month
        else:
            anio, mes_num = hoy.year, hoy.month

        nombre_mes = calendar.month_name[mes_num]
        MESES_ES = {
            'January':'Enero','February':'Febrero','March':'Marzo','April':'Abril',
            'May':'Mayo','June':'Junio','July':'Julio','August':'Agosto',
            'September':'Septiembre','October':'Octubre','November':'Noviembre','December':'Diciembre'
        }
        nombre_mes_es = MESES_ES.get(nombre_mes, nombre_mes)

        # ── Carrera: codigo → nombre completo ────────────────────────────────
        CARRERAS_MAP = {
            'LAF': 'Lic. Administrativa - Finanzas',
            'LCM': 'Lic. Comercial - Mercadeo',
            'IGI': 'Ing. Gestión Industrial',
            'ICE': 'Ing. Cibernética Electrónica',
            'IME': 'Ing. Mecánica y Energías Renovables',
            'IMS': 'Ing. Mecatrónica y Sistemas',
            'IEM': 'Ing. Electromédica',
        }

        # ── Solo préstamos DEVUELTOS en el mes seleccionado ──────────────────
        tz_local = timezone.get_current_timezone()
        primer_dia = timezone.make_aware(dt(anio, mes_num, 1, 0, 0, 0), tz_local)
        ultimo_dia_num = calendar.monthrange(anio, mes_num)[1]
        ultimo_dia = timezone.make_aware(dt(anio, mes_num, ultimo_dia_num, 23, 59, 59), tz_local)

        prestamos = (
            Prestamo.objects
            .filter(estado='DEVUELTO', fecha_recepcion__range=(primer_dia, ultimo_dia))
            .select_related('estudiante', 'entregado_por', 'recibido_por')
            .prefetch_related('detalles__equipo')
            .order_by('fecha_recepcion')
        )

        # ── Crear workbook ────────────────────────────────────────────────────
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"Prestamos {nombre_mes_es} {anio}"

        # Estilos reutilizables
        fill_ulsa    = PatternFill(fill_type='solid', start_color=COLOR_ULSA, end_color=COLOR_ULSA)
        fill_header  = PatternFill(fill_type='solid', start_color='1A6B20', end_color='1A6B20')   # verde más oscuro
        font_white14 = Font(name='Calibri', bold=True, size=14, color=COLOR_HEADER_TEXT)
        font_white11 = Font(name='Calibri', bold=True, size=11, color=COLOR_HEADER_TEXT)
        font_bold    = Font(name='Calibri', bold=True, size=10)
        font_normal  = Font(name='Calibri', size=10)
        align_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
        align_left   = Alignment(horizontal='left',   vertical='center', wrap_text=True)

        thin = Side(border_style='thin', color='AAAAAA')
        border_all = Border(left=thin, right=thin, top=thin, bottom=thin)

        TOTAL_COLS = 16  # A..P

        # ── Fila 1: Título institucional ──────────────────────────────────────
        ws.merge_cells(f'A1:{get_column_letter(TOTAL_COLS)}1')
        titulo = ws['A1']
        titulo.value = 'SISTEMA DE GESTIÓN DE PRÉSTAMOS DEPORTIVOS — ULSA'
        titulo.font    = font_white14
        titulo.fill    = fill_ulsa
        titulo.alignment = align_center
        ws.row_dimensions[1].height = 30

        # ── Fila 2: Subtítulo con mes/año ─────────────────────────────────────
        ws.merge_cells(f'A2:{get_column_letter(TOTAL_COLS)}2')
        subtitulo = ws['A2']
        subtitulo.value = f'Reporte de Préstamos Devueltos — {nombre_mes_es} {anio}'
        subtitulo.font    = Font(name='Calibri', bold=True, size=11, color=COLOR_ULSA)
        subtitulo.alignment = align_center
        ws.row_dimensions[2].height = 20

        # ── Fila 3: En blanco (separación) ───────────────────────────────────
        ws.row_dimensions[3].height = 8

        # ── Fila 4: Encabezados de columnas ──────────────────────────────────
        encabezados = [
            'N°', '# Ticket',
            'Fecha Solicitud', 'Hora Solicitud',
            'Fecha Límite Dev.', 'Fecha Real Dev.', 'Hora Devolución',
            'N° Carnet', 'Nombre Solicitante', 'Carrera', 'Año',
            'Equipos Prestados',
            'Entregado por', 'Recibido por',
            'Estado', 'Observaciones'
        ]
        ws.append([''] * TOTAL_COLS)  # placeholder fila 3
        for col_idx, enc in enumerate(encabezados, start=1):
            cell = ws.cell(row=4, column=col_idx, value=enc)
            cell.fill      = fill_header
            cell.font      = font_white11
            cell.alignment = align_center
            cell.border    = border_all
        ws.row_dimensions[4].height = 28

        # Helper seguro para formatear fechas sin error de zona horaria
        def format_dt(dt_val, fmt='%d/%m/%Y'):
            if not dt_val:
                return 'N/A'
            try:
                if timezone.is_naive(dt_val):
                    dt_val = timezone.make_aware(dt_val, tz_local)
                dt_local = timezone.localtime(dt_val, tz_local)
                return dt_local.strftime(fmt)
            except Exception:
                return str(dt_val)[:10]

        # ── Filas de datos ────────────────────────────────────────────────────
        fila_inicio = 5
        total_tickets  = 0
        total_equipos  = 0

        for idx, p in enumerate(prestamos, start=1):
            es_par = (idx % 2 == 0)
            fill_color = COLOR_FILA_PAR if es_par else COLOR_FILA_IMPAR
            fill_fila = PatternFill(fill_type='solid', start_color=fill_color, end_color=fill_color)

            fecha_sol_fecha = format_dt(p.fecha_prestamo, '%d/%m/%Y')
            fecha_sol_hora  = format_dt(p.fecha_prestamo, '%H:%M')
            fecha_limite    = format_dt(p.fecha_devolucion, '%d/%m/%Y')
            fecha_dev_fecha = format_dt(p.fecha_recepcion, '%d/%m/%Y')
            fecha_dev_hora  = format_dt(p.fecha_recepcion, '%H:%M')

            nombre_persona = p.solicitante_externo if p.solicitante_externo else \
                f"{p.estudiante.first_name} {p.estudiante.last_name}".strip() or p.estudiante.username
            carrera_nombre = CARRERAS_MAP.get(p.estudiante.carrera or '', p.estudiante.carrera or 'N/A')
            entregado_por  = p.entregado_por.username if p.entregado_por else 'N/A'
            recibido_por   = p.recibido_por.username if p.recibido_por else 'N/A'

            # Equipos como lista en una celda
            equipos_lista = ' ; '.join(
                f"{d.equipo.nombre}"
                f"{f' ({d.equipo.marca_modelo})' if d.equipo.marca_modelo else ''}"
                f"{f' [{d.equipo.color}]' if d.equipo.color else ''}"
                f" ×{d.cantidad}"
                for d in p.detalles.all()
            )
            cant_equipos = sum(d.cantidad for d in p.detalles.all())
            total_equipos += cant_equipos

            # Color del estado
            color_estado = {
                'DEVUELTO':  COLOR_DEVUELTO,
                'PENDIENTE': COLOR_PENDIENTE,
                'ACTIVO':    COLOR_PENDIENTE,
                'ATRASADO':  COLOR_ATRASADO,
                'RECHAZADO': COLOR_RECHAZADO,
            }.get(p.estado, 'FFFFFF')

            fila_datos = [
                idx,                                                   # A - N°
                p.id,                                                  # B - Ticket
                fecha_sol_fecha,                                       # C - Fecha solicitud
                fecha_sol_hora,                                        # D - Hora solicitud
                fecha_limite,                                          # E - Fecha limite
                fecha_dev_fecha,                                       # F - Fecha real dev
                fecha_dev_hora,                                        # G - Hora dev
                p.estudiante.carnet or 'N/A',                          # H - Carnet
                nombre_persona,                                        # I - Nombre
                carrera_nombre,                                        # J - Carrera
                p.estudiante.ano_cursado or 'N/A',                     # K - Año
                equipos_lista,                                         # L - Equipos
                entregado_por,                                         # M - Entregado por
                recibido_por,                                          # N - Recibido por
                p.estado,                                              # O - Estado
                p.observaciones or '',                                 # P - Observaciones
            ]

            row_num = fila_inicio + idx - 1
            ws.append(fila_datos)
            ws.row_dimensions[row_num].height = 22

            for col_idx, val in enumerate(fila_datos, start=1):
                cell = ws.cell(row=row_num, column=col_idx)
                cell.border    = border_all
                cell.font      = font_normal
                cell.alignment = align_center if col_idx in (1, 2, 3, 4, 5, 6, 7, 10, 11, 14, 15) else align_left

                if col_idx == 15:  # columna Estado con color
                    cell.fill = PatternFill(fill_type='solid', start_color=color_estado, end_color=color_estado)
                    cell.font = Font(name='Calibri', bold=True, size=10)
                else:
                    cell.fill = fill_fila

            total_tickets += 1

        # ── Fila de totales ───────────────────────────────────────────────────
        row_totales = fila_inicio + total_tickets
        ws.merge_cells(f'A{row_totales}:K{row_totales}')
        cell_tot = ws[f'A{row_totales}']
        cell_tot.value     = f'TOTAL: {total_tickets} préstamos devueltos  |  {total_equipos} equipos prestados en total'
        cell_tot.font      = Font(name='Calibri', bold=True, size=10, color=COLOR_ULSA)
        cell_tot.fill      = PatternFill(fill_type='solid', start_color='E8F5E9', end_color='E8F5E9')
        cell_tot.alignment = align_center
        cell_tot.border    = border_all
        ws.row_dimensions[row_totales].height = 22

        # ── Anchos de columna ─────────────────────────────────────────────────
        anchos = [5, 8, 13, 10, 13, 13, 10, 12, 30, 28, 6, 45, 20, 20, 12, 30]
        for i, ancho in enumerate(anchos, start=1):
            ws.column_dimensions[get_column_letter(i)].width = ancho

        # ── Freeze panes (congelar encabezados) ───────────────────────────────
        ws.freeze_panes = 'A5'

        # ── Respuesta HTTP ────────────────────────────────────────────────────
        nombre_archivo = f'Reporte_Prestamos_{nombre_mes_es}_{anio}.xlsx'
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        response['X-Filename'] = nombre_archivo
        response['Access-Control-Expose-Headers'] = 'Content-Disposition, X-Filename'
        wb.save(response)
        return response

    except Exception as e:
        logger.exception("Error generando reporte Excel: %s", str(e))
        return Response({'detail': f'Error al generar el reporte Excel: {str(e)}'}, status=500)


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

from django.http import JsonResponse
def clear_broken_images_view(request):
    cleared = []
    for e in Equipo.objects.exclude(imagen=''):
        exists = False
        if e.imagen:
            try:
                exists = os.path.exists(e.imagen.path)
            except Exception:
                pass
        if not exists:
            cleared.append(e.id)
            e.imagen = None
            e.save()
    return JsonResponse({"cleared_ids": cleared})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def my_ip(request):
    """
    Ruta pública para diagnosticar problemas de red.
    Devuelve la IP pública real que el servidor (Render) está detectando.
    """
    from sgped_api.network_middleware import _get_client_ip
    ip = _get_client_ip(request)
    return Response({
        'ip_detectada': ip,
        'mensaje': 'Usa esta IP para configurar ALLOWED_IPS en Render. También soporta CIDR (ej: 190.212.45.0/24)'
    })