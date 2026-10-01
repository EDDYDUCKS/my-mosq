"""
Manejador global de excepciones para Django REST Framework.
Estandariza los mensajes de error en un formato predecible y amigable:
{
    "detail": "Mensaje legible del error",
    "errors": { ... },
    "status_code": 400
}
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import exceptions
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    # Interceptar ValidationError de modelos de Django y convertirlo a DRF ValidationError
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            exc = exceptions.ValidationError(detail=exc.message_dict)
        elif hasattr(exc, 'messages'):
            exc = exceptions.ValidationError(detail=exc.messages)
        else:
            exc = exceptions.ValidationError(detail=str(exc))

    # Llamar al manejador por defecto de DRF para obtener la respuesta inicial
    response = exception_handler(exc, context)

    if response is not None:
        formatted_data = {
            'status_code': response.status_code,
        }

        # Extraer detalle general
        if isinstance(response.data, dict):
            if 'detail' in response.data:
                formatted_data['detail'] = str(response.data['detail'])
                extra_errors = {k: v for k, v in response.data.items() if k != 'detail'}
                if extra_errors:
                    formatted_data['errors'] = extra_errors
            else:
                first_key = next(iter(response.data))
                first_val = response.data[first_key]
                if isinstance(first_val, list) and first_val:
                    formatted_data['detail'] = f"{first_key}: {first_val[0]}"
                else:
                    formatted_data['detail'] = f"{first_key}: {first_val}"
                formatted_data['errors'] = response.data
        elif isinstance(response.data, list):
            formatted_data['detail'] = str(response.data[0]) if response.data else 'Error de validación.'
            formatted_data['errors'] = {'non_field_errors': response.data}
        else:
            formatted_data['detail'] = str(response.data)

        response.data = formatted_data

    return response
