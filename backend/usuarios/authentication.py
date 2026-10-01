from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import TokenAuthentication, get_authorization_header

# Expiración configurable en horas (por defecto 24 horas)
TOKEN_EXPIRE_HOURS = getattr(settings, 'TOKEN_EXPIRE_HOURS', 24)


class ExpiringTokenAuthentication(TokenAuthentication):
    """
    Autenticación por Token que:
    1. Acepta tanto prefijo 'Token' como 'Bearer' en el header Authorization.
    2. Valida la fecha de creación del token frente al TTL (TOKEN_EXPIRE_HOURS).
    3. Si ha expirado, elimina el token de la BD y rechaza con AuthenticationFailed.
    """

    def authenticate(self, request):
        auth = get_authorization_header(request).split()

        if not auth:
            return None

        # Soportar tanto 'Token' como 'Bearer'
        prefix = auth[0].decode('utf-8', errors='ignore').lower()
        if prefix not in ('token', 'bearer'):
            return None

        if len(auth) == 1:
            msg = 'Encabezado de autorización inválido. No se proporcionaron credenciales.'
            raise exceptions.AuthenticationFailed(msg)
        elif len(auth) > 2:
            msg = 'Encabezado de autorización inválido. El string del token no debe contener espacios.'
            raise exceptions.AuthenticationFailed(msg)

        try:
            token_key = auth[1].decode('utf-8', errors='ignore')
        except UnicodeError:
            msg = 'Encabezado de autorización inválido. Caracteres no válidos.'
            raise exceptions.AuthenticationFailed(msg)

        return self.authenticate_credentials(token_key)

    def authenticate_credentials(self, key):
        model = self.get_model()
        try:
            token = model.objects.select_related('user').get(key=key)
        except model.DoesNotExist:
            raise exceptions.AuthenticationFailed('Token inválido.')

        if not token.user.is_active:
            raise exceptions.AuthenticationFailed('Usuario inactivo o bloqueado.')

        # Verificar si el token ya excedió el tiempo límite
        tiempo_expiracion = token.created + timedelta(hours=TOKEN_EXPIRE_HOURS)
        if timezone.now() > tiempo_expiracion:
            token.delete()
            raise exceptions.AuthenticationFailed('El token de sesión ha expirado. Por favor inicia sesión nuevamente.')

        return (token.user, token)
