# Guía de Operaciones, Configuración y Cron Jobs — MOSQ / SGPED
Sistema de Gestión de Préstamos de Equipos Deportivos  
Universidad Tecnológica La Salle (ULSA) · Bienestar Estudiantil

---

## 1. Arquitectura de Despliegue

- **Backend:** Django 6 + Django REST Framework 3.16. Desplegado en **Render** (Web Service con Gunicorn y WhiteNoise).
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS 4. Desplegado en **Vercel** o **Render Static Site**.
- **Base de Datos:** PostgreSQL en **Supabase** (conectado vía connection pooler en puerto 5432 con SSL obligatorio).
- **Almacenamiento Multimedia:** Supabase Storage (bucket para fotografías de equipos y firmas/evidencias).

---

## 2. Variables de Entorno

### Backend (`backend/.env` o Render Environment Variables)

| Variable | Tipo / Ejemplo | Descripción | Requerido en Prod |
| :--- | :--- | :--- | :--- |
| `SECRET_KEY` | `string` criptográfico | Llave secreta de Django. **Si `DEBUG=False` y no está definida, el servidor se rehúsa a iniciar por seguridad.** | **SÍ** |
| `DEBUG` | `False` / `True` | Modo depuración. Debe ser `False` en producción. | **SÍ** (`False`) |
| `ALLOWED_HOSTS` | `mosq-api.onrender.com,localhost` | Hosts/dominios HTTP autorizados para recibir peticiones (separados por coma). | **SÍ** |
| `CORS_ALLOWED_ORIGINS` | `https://mosq.ulsa.edu.ni,http://localhost:3000` | Orígenes del cliente frontend autorizados para solicitudes CORS (separados por coma). | **SÍ** |
| `ALLOWED_IPS` | `192.168.1.0/24,200.85.x.x` o `*` | Restricción de red institucional por IP o CIDR. Si se configura `*`, se permite cualquier red. | Opcional (def: `*`) |
| `DB_NAME` | `postgres` | Nombre de la base de datos PostgreSQL en Supabase. | **SÍ** |
| `DB_USER` | `postgres.<project_ref>` | Usuario de base de datos Supabase. | **SÍ** |
| `DB_PASSWORD` | `<contraseña>` | Contraseña del usuario de base de datos. | **SÍ** |
| `DB_HOST` | `aws-1-us-east-1.pooler.supabase.com` | Host del connection pooler o directo de Supabase. | **SÍ** |
| `DB_PORT` | `5432` | Puerto PostgreSQL (5432 o 6543 en Supabase pooler). | **SÍ** |
| `DB_SSLMODE` | `require` | Modo de verificación SSL para la conexión a la base de datos. | **SÍ** |
| `TIME_ZONE` | `America/Managua` | Zona horaria del sistema. Configurado a `America/Managua` (UTC-6) de manera predeterminada. | Opcional |
| `GOOGLE_OAUTH_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Client ID de Google Cloud para validar tokens de inicio de sesión institucional `@ulsa.edu.ni`. | **SÍ** |
| `ADMIN_EMAILS` | `bienestar@ulsa.edu.ni,admin@ulsa.edu.ni` | Lista de correos institucionales que obtienen automáticamente rol de staff/administrador al loguearse. | Recomendado |
| `SUPABASE_URL` | `https://xxx.supabase.co` | URL del proyecto Supabase para almacenamiento de archivos. | Recomendado |
| `SUPABASE_KEY` | `<service_role_o_anon_key>` | Llave API de Supabase para subir imágenes de equipos. | Recomendado |
| `SUPABASE_BUCKET` | `equipos-fotos` | Nombre del bucket en Supabase Storage. | Recomendado |

### Frontend (`frontend/.env.production` o Vercel Environment Variables)

| Variable | Ejemplo | Descripción |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://mosq-api.onrender.com` | URL base de la API REST de Django (sin barra final). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Client ID de Google OAuth para el componente de autenticación institucional. |

---

## 3. Automatización y Jobs Programados (Cron Jobs)

### Comando: `procesar_atrasados`

```bash
python manage.py procesar_atrasados
```

#### ¿Qué realiza este job?
1. Consulta todos los préstamos en estado `ACTIVO` cuya `fecha_devolucion` sea anterior al momento actual en zona horaria `America/Managua`.
2. Para cada préstamo vencido:
   - Actualiza el estado a `ATRASADO`.
   - Crea un registro de auditoría (`AuditoriaPrestamo`) indicando: *"Marcado como atrasado automáticamente por el sistema"*.
   - Incrementa en 1 el contador `veces_atrasado` del estudiante solicitante.
3. El proceso es **100% transaccional e idempotente** (no duplica penalizaciones ni auditorías si se ejecuta repetidamente).

#### Configuración en Render (Recomendado)
En el panel de control de Render:
1. Crear un **Cron Job**:
   - **Name:** `mosq-cron-atrasados`
   - **Environment:** `Python`
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Schedule:** `*/15 * * * *` (se ejecuta cada 15 minutos) o `0 19-22 * * 1-5` (cada hora entre 7 PM y 10 PM de lunes a viernes).
   - **Command:** `cd backend && python manage.py procesar_atrasados`
2. Enlazar el mismo Environment Group o variables de entorno que el Web Service principal.

#### Configuración en Crontab (Servidor Linux dedicado)
```cron
# Procesar préstamos atrasados cada 15 minutos
*/15 * * * * cd /var/www/mosq/backend && /var/www/mosq/backend/env/bin/python manage.py procesar_atrasados >> /var/log/mosq_atrasados.log 2>&1
```

---

## 4. Políticas de Seguridad y Autenticación

1. **Expiración de Tokens:**
   - Los tokens de sesión (`DRF Token`) tienen una validez máxima de **24 horas**.
   - Los endpoints aceptan tanto el prefijo estándar `Token <token>` como el estándar moderno `Bearer <token>`.
   - Si un token supera las 24 horas, la API responde con código `401 Unauthorized` indicando que el token ha expirado.
2. **Rotación y Cierre de Sesión:**
   - Al iniciar sesión con credenciales o Google OAuth, cualquier token anterior del usuario es revocado y se emite uno nuevo.
   - Endpoint `POST /api/auth/logout/`: Elimina el token activo en base de datos.
3. **Sanciones y Suspensión:**
   - Las sanciones con `fecha_fin` transcurrida se desactivan automáticamente al iniciar sesión o consultar `/api/usuarios/me/`.
   - Si el estudiante cuenta con una sanción activa vigente, el sistema bloquea la creación de nuevos préstamos.
4. **Diagnóstico de Red:**
   - La ruta `/api/red/mi-ip/` está restringida únicamente a usuarios administradores (`IsAdminUser`).

---

## 5. Mantenimiento y Comandos Útiles

```bash
# Entrar al directorio del backend
cd backend

# Aplicar migraciones pendientes
python manage.py migrate

# Ejecutar suite de pruebas unitarias
python manage.py test

# Forzar recolección de archivos estáticos
python manage.py collectstatic --noinput

# Crear superusuario inicial de administración
python manage.py createsuperuser

# Probar ejecución de comando de atrasos con salida detallada
python manage.py procesar_atrasados -v 2
```
