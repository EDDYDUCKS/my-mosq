"""
Supabase Storage backend for Django.

Sube los archivos (imágenes de equipos) a un bucket público de Supabase Storage
en lugar del disco local. Esto resuelve el problema de almacenamiento efímero
de Render, donde los archivos se pierden en cada deploy/reinicio.

Requiere dos variables de entorno:
  SUPABASE_URL          – ej. https://hoiebtxvwbupkxinmtgl.supabase.co
  SUPABASE_SERVICE_KEY  – la service_role key del proyecto

Si las variables NO están configuradas, cae automáticamente a FileSystemStorage
(disco local de Django) para que el desarrollo local siga funcionando.
"""

import os
import uuid
import requests as http_requests
from django.core.files.storage import Storage, FileSystemStorage
from django.core.files.base import ContentFile
from django.conf import settings as django_settings


class SupabaseStorage(Storage):
    """Django Storage que sube archivos a Supabase Storage."""

    BUCKET = 'equipos'

    # --- helpers internos ---
    @property
    def _url(self):
        return os.environ.get('SUPABASE_URL', '')

    @property
    def _key(self):
        return os.environ.get('SUPABASE_SERVICE_KEY', '')

    @property
    def _is_configured(self):
        return bool(self._url and self._key)

    def _headers(self, content_type='application/octet-stream', upsert=False):
        h = {
            'Authorization': f'Bearer {self._key}',
            'Content-Type': content_type,
        }
        if upsert:
            h['x-upsert'] = 'true'
        return h

    # --- API de Django Storage ---

    def _get_fallback_storage(self):
        """FileSystemStorage como fallback cuando Supabase no está configurado."""
        return FileSystemStorage(
            location=django_settings.MEDIA_ROOT,
            base_url=django_settings.MEDIA_URL,
        )

    def _save(self, name, content):
        """Sube el archivo a Supabase y devuelve la ruta almacenada."""
        if not self._is_configured:
            # Sin credenciales: guardar en disco local con FileSystemStorage real
            return self._get_fallback_storage()._save(name, content)

        # Nombre único para evitar colisiones
        ext = os.path.splitext(name)[1].lower() or '.jpg'
        unique_name = f"equipos/{uuid.uuid4().hex}{ext}"

        file_data = content.read()
        content_type = getattr(content, 'content_type', None) or 'image/jpeg'

        url = f"{self._url}/storage/v1/object/{self.BUCKET}/{unique_name}"
        resp = http_requests.post(
            url,
            headers=self._headers(content_type, upsert=True),
            data=file_data,
            timeout=30,
        )
        
        if not resp.ok:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(f"Error de Supabase: {resp.status_code} - {resp.text}")

        # Retornamos la ruta relativa dentro del bucket.
        # Django guarda esto en el campo `imagen` de la BD.
        return unique_name

    def url(self, name):
        """Devuelve la URL pública del archivo."""
        if not name:
            return ''
        # Si ya es una URL absoluta (dato viejo o migrado), devolver tal cual
        if name.startswith('http'):
            return name
        if not self._is_configured:
            # dev local / sin Supabase: usar FileSystemStorage para obtener la URL
            return self._get_fallback_storage().url(name)
        return f"{self._url}/storage/v1/object/public/{self.BUCKET}/{name}"

    def exists(self, name):
        """Retorna False para siempre permitir sobreescritura (upsert)."""
        return False

    def delete(self, name):
        """Elimina el archivo de Supabase."""
        if not name or not self._is_configured:
            return
        url = f"{self._url}/storage/v1/object/{self.BUCKET}/{name}"
        try:
            http_requests.delete(
                url,
                headers={'Authorization': f'Bearer {self._key}'},
                timeout=10,
            )
        except Exception:
            pass  # No fallar si no se pudo borrar

    def _open(self, name, mode='rb'):
        """Descarga el archivo de Supabase (raramente usado)."""
        file_url = self.url(name)
        resp = http_requests.get(file_url, timeout=15)
        resp.raise_for_status()
        return ContentFile(resp.content)

    def size(self, name):
        return 0  # No implementado, no es requerido

    def get_valid_name(self, name):
        return name

    def get_available_name(self, name, max_length=None):
        # _save ya genera nombre único, no necesitamos lógica extra
        return name
