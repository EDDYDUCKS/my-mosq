"""
Middleware de Django que restringe el acceso a la API
solo a IPs autorizadas (red WiFi de la universidad).

Configurar en .env:
    ALLOWED_IPS=208.96.129.55,127.0.0.1

Puedes poner IPs exactas o prefijos de subred (ej: "192.168.1.").
En modo DEBUG=True, localhost siempre está permitido.
"""

import os
from django.http import JsonResponse


def _get_client_ip(request):
    """Obtiene la IP real del cliente, respetando proxies."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def _is_allowed(ip: str, allowed: list[str], debug: bool) -> bool:
    # Si la lista contiene '*', permitir todo (ideal para pruebas o demostraciones)
    if '*' in allowed:
        return True
        
    # En modo DEBUG, siempre permitir localhost
    if debug and ip in ('127.0.0.1', '::1', 'localhost'):
        return True
    for entry in allowed:
        if entry.endswith('.'):          # prefijo de subred
            if ip.startswith(entry):
                return True
        else:                            # IP exacta
            if ip == entry:
                return True
    return False


class AllowedNetworkMiddleware:
    """Rechaza peticiones API que no vengan de la red autorizada."""

    # Rutas que se excluyen de la restricción (login, admin Django, etc.)
    EXEMPT_PREFIXES = ('/admin/', '/api/auth/', '/api/login/', '/api/google-login/', '/api/fix-images/')

    def __init__(self, get_response):
        self.get_response = get_response
        raw = os.getenv('ALLOWED_IPS', '208.96.129.55,127.0.0.1')
        self.allowed = [s.strip() for s in raw.split(',') if s.strip()]
        self.debug = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')

    def __call__(self, request):
        path = request.path_info

        # Rutas exentas (para no bloquear el propio login)
        if any(path.startswith(p) for p in self.EXEMPT_PREFIXES):
            return self.get_response(request)

        ip = _get_client_ip(request)

        if not _is_allowed(ip, self.allowed, self.debug):
            return JsonResponse(
                {'detail': 'Acceso restringido a la red de la universidad.'},
                status=403,
            )

        return self.get_response(request)
