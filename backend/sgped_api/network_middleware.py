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
    """Obtiene la IP real del cliente, respetando proxies como Render."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        parts = [p.strip() for p in forwarded.split(',') if p.strip()]
        if parts:
            return parts[0]
    return (request.META.get('REMOTE_ADDR') or '').strip()


import ipaddress

def _is_allowed(ip_str: str, allowed: list[str], debug: bool) -> bool:
    # Si la lista contiene '*' o está vacía, permitir todo
    if not allowed or '*' in allowed:
        return True
        
    # En modo DEBUG, siempre permitir localhost
    if debug and ip_str in ('127.0.0.1', '::1', 'localhost'):
        return True

    if not ip_str:
        return False
        
    try:
        client_ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
        
    for entry in allowed:
        try:
            # Soporta tanto IP exacta (190.212.45.1) como rango (190.212.45.0/24)
            network = ipaddress.ip_network(entry, strict=False)
            if client_ip in network:
                return True
        except ValueError:
            # Fallback a coincidencia exacta de string por si acaso
            if ip_str == entry:
                return True
                
    return False


class AllowedNetworkMiddleware:
    """Rechaza peticiones API que no vengan de la red autorizada."""

    # Rutas que se excluyen de la restricción (login, admin Django, health checks, etc.)
    EXEMPT_PREFIXES = (
        '/admin/',
        '/api/auth/',
        '/api/login/',
        '/api/google-login/',
        '/api/fix-images/',
        '/media/',
        '/static/',
        '/favicon.ico',
        '/health/',
        '/api/equipos/',
        '/api/my-ip/',
        '/api/prestamos/',
        '/api/sanciones/',
        '/api/estudiantes/',
        '/api/reportes/',
        '/api/bitacora/',
    )

    def __init__(self, get_response):
        self.get_response = get_response
        raw = os.getenv('ALLOWED_IPS', '*').strip()
        if not raw or raw == '*':
            self.allowed = ['*']
        else:
            self.allowed = [s.strip() for s in raw.split(',') if s.strip()]
        self.debug = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')

    def __call__(self, request):
        # Fast-path: si ALLOWED_IPS es wildcard, no procesar verificaciones de red
        if '*' in self.allowed:
            return self.get_response(request)

        path = request.path_info

        # Rutas exentas
        if any(path.startswith(p) for p in self.EXEMPT_PREFIXES):
            return self.get_response(request)

        ip = _get_client_ip(request)

        if not _is_allowed(ip, self.allowed, self.debug):
            return JsonResponse(
                {'detail': 'Acceso restringido a la red de la universidad.'},
                status=403,
            )

        return self.get_response(request)
