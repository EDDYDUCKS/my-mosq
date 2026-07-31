import logging
from django.core.mail import send_mail
from django.conf import settings
from .models import BitacoraAccion

logger = logging.getLogger(__name__)

def registrar_auditoria(usuario, accion, descripcion, ip_address=None):
    """
    Registra una acción de auditoría en la base de datos de forma segura.
    Sanitiza y trunca la IP a máximo 45 caracteres (límite de la BD) para evitar DataError en proxies.
    """
    try:
        ip_clean = ''
        if ip_address:
            # Si viene con múltiples IPs por proxy (ej: "192.168.1.1, 10.0.0.1"), tomar la primera real
            ip_str = str(ip_address).split(',')[0].strip()
            ip_clean = ip_str[:45]

        BitacoraAccion.objects.create(
            usuario=usuario if (usuario and hasattr(usuario, 'is_authenticated') and usuario.is_authenticated) else None,
            accion=accion,
            descripcion=descripcion,
            ip_address=ip_clean
        )
    except Exception as e:
        logger.exception("Error registrando auditoría: %s", str(e))

def enviar_notificacion_email(destinatario_email, asunto, mensaje_texto, mensaje_html=None):
    """
    Envía una notificación por correo electrónico envuelta en try...except
    para garantizar que nunca bloquee la ejecución de la API si SMTP falla.
    """
    if not destinatario_email:
        return
    try:
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@ulsa.edu.ni')
        send_mail(
            subject=asunto,
            message=mensaje_texto,
            from_email=from_email,
            recipient_list=[destinatario_email],
            html_message=mensaje_html,
            fail_silently=True,
        )
    except Exception as e:
        logger.warning("No se pudo enviar el correo a %s: %s", destinatario_email, str(e))
