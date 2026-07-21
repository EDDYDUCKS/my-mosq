import { Equipment, LoanRequest, Sanction, User } from '@/lib/types';

export const AUTH_TOKEN_KEY = 'gear_auth_token';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: RequestMethod;
  body?: unknown;
  auth?: boolean;
  responseType?: 'json' | 'blob';
}

interface BackendEquipo {
  id: number;
  nombre: string;
  marca_modelo: string | null;
  color: string | null;
  descripcion: string | null;
  imagen_url: string | null;
  cantidad_total: number;
  cantidad_disponible: number;
}

interface BackendDetallePrestamo {
  id: number;
  equipo: number;
  cantidad: number;
  equipo_detalle?: BackendEquipo;
}

interface BackendPrestamo {
  id: number;
  estudiante: number;
  estudiante_detalle?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    carnet?: string | null;
    carrera?: string | null;
    ano_cursado?: string | null;
  };
  entregado_por_detalle?: {
    first_name?: string;
    last_name?: string;
    username?: string;
  } | null;
  recibido_por_detalle?: {
    first_name?: string;
    last_name?: string;
    username?: string;
  } | null;
  fecha_prestamo: string;
  fecha_devolucion: string | null;
  fecha_recepcion: string | null;
  estado: 'PENDIENTE' | 'ACTIVO' | 'DEVUELTO' | 'RECHAZADO' | 'ATRASADO';
  solicitante_externo?: string | null;
  observaciones?: string | null;
  detalles: BackendDetallePrestamo[];
}

interface BackendLoginResponse {
  token: string;
  user: User;
  requiere_completar_perfil?: boolean;
}

interface BackendSancion {
  id: number;
  estudiante: number;
  estudiante_detalle?: {
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  motivo: string;
  observaciones?: string | null;
  severidad: 'warning' | 'restriction' | 'ban';
  fecha_inicio: string;
  fecha_fin: string | null;
  activa: boolean;
  fecha_resolucion: string | null;
}

function toPublicPath(fileName: string): string {
  return encodeURI(`/${fileName}`);
}

// Normaliza un string quitando acentos/tildes para comparaciones robustas.
// "Sóftbol" → "softbol", "Fútbol" → "futbol", "Béisbol" → "beisbol"
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolveEquipmentImage(name: string): string {
  const normalizedName = stripAccents(name.toLowerCase());

  if (normalizedName.includes('red') && normalizedName.includes('futbol')) {
    return toPublicPath('reddefutbol.png');
  }

  if (normalizedName.includes('guante') && (normalizedName.includes('futbol') || normalizedName.includes('portero'))) {
    return toPublicPath('guantefutbol.png');
  }

  if (
    normalizedName.includes('baloncesto')
    || normalizedName.includes('basket')
    || normalizedName.includes('basquet')
    || normalizedName.includes('basquetbol')
  ) {
    return toPublicPath('basketball.png');
  }

  if (
    normalizedName.includes('softball')
    || normalizedName.includes('softbol')
  ) {
    return toPublicPath('bolasoftball.png');
  }

  if (normalizedName.includes('chaleco')) {
    return toPublicPath('balonfutbol.png');
  }

  if (normalizedName.includes('futbol')) {
    return toPublicPath('balonfutbol.png');
  }

  if (normalizedName.includes('beisbol')) {
    if (normalizedName.includes('bate')) {
      return toPublicPath('batebeisbol.png');
    }

    if (normalizedName.includes('guante')) {
      return toPublicPath('guantebeisbol.png');
    }

    if (normalizedName.includes('proteccion') || normalizedName.includes('mascara')) {
      return toPublicPath('proteccion de beisbol.png');
    }

    return toPublicPath('pelotabeisbol.png');
  }

  if (normalizedName.includes('cono')) {
    if (normalizedName.includes('grande')) {
      return toPublicPath('conosgrandes.png');
    }
    return toPublicPath('conospeque.png');
  }

  if (normalizedName.includes('voleibol') || normalizedName.includes('volley') || normalizedName.includes('volleyball')) {
    if (normalizedName.includes('pelota') || normalizedName.includes('balon')) {
      return toPublicPath('bolaVolleyball.png');
    }
    return toPublicPath('redvolley.png');
  }

  if (normalizedName.includes('tablero') || normalizedName.includes('ajedrez')) {
    return toPublicPath('tablero.png');
  }

  return '/placeholder.jpg';
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, responseType = 'json' } = options;
  const token = auth ? getAuthToken() : null;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Si el body es FormData, no seteamos Content-Type (el browser lo pone automático con boundary)
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? (isFormData ? body as BodyInit : JSON.stringify(body)) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    let detail = 'No se pudo completar la solicitud.';

    try {
      const data = await response.json();
      if (data?.detail) {
        detail = String(data.detail);
      } else {
        detail = JSON.stringify(data);
      }
    } catch {
      // Ignorar parse de error
    }

    throw new Error(detail);
  }

  if (responseType === 'blob') {
    return (await response.blob()) as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function mapEquipment(item: BackendEquipo): Equipment {
  return {
    id: String(item.id),
    name: item.nombre,
    marca_modelo: item.marca_modelo || undefined,
    color: item.color || undefined,
    category: 'General',
    description: item.descripcion || 'Sin descripción',
    available: item.cantidad_disponible,
    total: item.cantidad_total,
    imageUrl: item.imagen_url || resolveEquipmentImage(item.nombre),
    condition: 'good',
  };
}

function mapLoanStatus(status: BackendPrestamo['estado']): LoanRequest['status'] {
  if (status === 'DEVUELTO') return 'returned';
  if (status === 'RECHAZADO') return 'rejected';
  if (status === 'PENDIENTE') return 'pending';
  if (status === 'ATRASADO') return 'pending';
  return 'approved';
}

function formatPersonName(person?: {
  first_name?: string;
  last_name?: string;
  username?: string;
} | null): string | undefined {
  if (!person) return undefined;

  const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
  return fullName || person.username || undefined;
}

function mapLoans(prestamos: BackendPrestamo[]): LoanRequest[] {
  return prestamos.flatMap((prestamo) => {
    const studentName = prestamo.solicitante_externo 
      || `${prestamo.estudiante_detalle?.first_name || ''} ${prestamo.estudiante_detalle?.last_name || ''}`.trim()
      || prestamo.estudiante_detalle?.username
      || 'Estudiante';
    const deliveredByName = formatPersonName(prestamo.entregado_por_detalle);
    const receivedByName = formatPersonName(prestamo.recibido_por_detalle);

    return prestamo.detalles.map((detalle) => ({
      id: `${prestamo.id}-${detalle.id}`,
      loanGroupId: String(prestamo.id),
      studentId: String(prestamo.estudiante),
      studentName,
      studentCardId: prestamo.estudiante_detalle?.carnet || undefined,
      studentCareer: prestamo.estudiante_detalle?.carrera || undefined,
      studentYear: prestamo.estudiante_detalle?.ano_cursado || undefined,
      solicitante_externo: prestamo.solicitante_externo || null,
      notes: prestamo.observaciones || undefined,
      equipmentId: String(detalle.equipo),
      equipmentName: detalle.equipo_detalle
        ? `${detalle.equipo_detalle.nombre}${detalle.equipo_detalle.marca_modelo ? ` (${detalle.equipo_detalle.marca_modelo})` : ''}${detalle.equipo_detalle.color ? ` [${detalle.equipo_detalle.color}]` : ''}`
        : `Equipo #${detalle.equipo}`,
      quantity: detalle.cantidad,
      requestDate: new Date(prestamo.fecha_prestamo),
      dueDate: new Date(prestamo.fecha_devolucion || prestamo.fecha_prestamo),
      receivedAt: prestamo.fecha_recepcion ? new Date(prestamo.fecha_recepcion) : undefined,
      status: mapLoanStatus(prestamo.estado),
      backendStatus: prestamo.estado,
      deliveredByName,
      receivedByName,
    }));
  });
}

function mapSanction(sancion: BackendSancion): Sanction {
  const studentName = `${sancion.estudiante_detalle?.first_name || ''} ${sancion.estudiante_detalle?.last_name || ''}`.trim()
    || sancion.estudiante_detalle?.username
    || `Estudiante #${sancion.estudiante}`;

  return {
    id: String(sancion.id),
    studentId: String(sancion.estudiante),
    studentName,
    reason: sancion.motivo,
    date: new Date(sancion.fecha_inicio),
    severity: sancion.severidad,
    expiryDate: sancion.fecha_fin ? new Date(sancion.fecha_fin) : undefined,
    notes: sancion.observaciones || undefined,
    isActive: sancion.activa,
    resolvedAt: sancion.fecha_resolucion ? new Date(sancion.fecha_resolucion) : undefined,
  };
}

export async function loginWithApi(email: string, password: string): Promise<BackendLoginResponse> {
  return apiRequest<BackendLoginResponse>('/auth/login/', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
}

export async function fetchCurrentUser(): Promise<User & { requiere_completar_perfil?: boolean }> {
  return apiRequest<User & { requiere_completar_perfil?: boolean }>('/auth/me/');
}

export async function fetchEquipment(): Promise<Equipment[]> {
  const data = await apiRequest<BackendEquipo[]>('/equipos/', { auth: false });
  return data.map(mapEquipment);
}

export async function createEquipment(payload: {
  nombre: string;
  marca_modelo?: string;
  color?: string;
  descripcion?: string;
  cantidad_total: number;
  cantidad_disponible: number;
  imagen?: File | null;
}): Promise<Equipment> {
  const formData = new FormData();
  formData.append('nombre', payload.nombre);
  if (payload.marca_modelo) formData.append('marca_modelo', payload.marca_modelo);
  if (payload.color) formData.append('color', payload.color);
  if (payload.descripcion) formData.append('descripcion', payload.descripcion);
  formData.append('cantidad_total', String(payload.cantidad_total));
  formData.append('cantidad_disponible', String(payload.cantidad_disponible));
  if (payload.imagen) formData.append('imagen', payload.imagen);

  const data = await apiRequest<BackendEquipo>('/equipos/', {
    method: 'POST',
    body: formData,
  });

  return mapEquipment(data);
}

export async function updateEquipment(
  equipmentId: string,
  payload: {
    nombre: string;
    marca_modelo?: string;
    color?: string;
    descripcion?: string;
    cantidad_total: number;
    cantidad_disponible: number;
    imagen?: File | null;
  },
): Promise<Equipment> {
  const formData = new FormData();
  formData.append('nombre', payload.nombre);
  if (payload.marca_modelo !== undefined) formData.append('marca_modelo', payload.marca_modelo);
  if (payload.color !== undefined) formData.append('color', payload.color);
  if (payload.descripcion !== undefined) formData.append('descripcion', payload.descripcion);
  formData.append('cantidad_total', String(payload.cantidad_total));
  formData.append('cantidad_disponible', String(payload.cantidad_disponible));
  if (payload.imagen) formData.append('imagen', payload.imagen);

  const data = await apiRequest<BackendEquipo>(`/equipos/${equipmentId}/`, {
    method: 'PATCH',
    body: formData,
  });

  return mapEquipment(data);
}

export async function deleteEquipment(equipmentId: string): Promise<void> {
  await apiRequest(`/equipos/${equipmentId}/`, {
    method: 'DELETE',
  });
}

export async function fetchStudentLoans(): Promise<LoanRequest[]> {
  const data = await apiRequest<BackendPrestamo[]>('/prestamos/');
  return mapLoans(data);
}

export async function fetchAdminLoans(): Promise<LoanRequest[]> {
  const data = await apiRequest<BackendPrestamo[]>('/prestamos/');
  return mapLoans(data);
}

export async function createLoan(payload: {
  estudiante: number;
  estado?: 'PENDIENTE' | 'ACTIVO';
  fecha_devolucion?: string;
  solicitante_externo?: string;
  observaciones?: string;
  detalles: Array<{ equipo: number; cantidad: number }>;
}): Promise<{ id: number }> {
  const data = await apiRequest<BackendPrestamo>('/prestamos/', {
    method: 'POST',
    body: {
      ...payload,
      estado: payload.estado || 'PENDIENTE',
    },
  });
  return { id: data.id };
}

export async function fetchLoanById(loanId: string): Promise<LoanRequest[]> {
  const data = await apiRequest<BackendPrestamo>(`/prestamos/${loanId}/`);
  return mapLoans([data]);
}

export async function updateLoanStatus(
  loanGroupId: string,
  status: 'ACTIVO' | 'DEVUELTO' | 'RECHAZADO' | 'ATRASADO' | 'PENDIENTE',
  motivoRechazo?: string,
): Promise<void> {
  const body: Record<string, string> = { estado: status };
  if (motivoRechazo) body.motivo_rechazo = motivoRechazo;
  await apiRequest(`/prestamos/${loanGroupId}/`, {
    method: 'PATCH',
    body,
  });
}

export async function markLoanAsReturned(loanGroupId: string): Promise<void> {
  await apiRequest(`/prestamos/${loanGroupId}/`, {
    method: 'PATCH',
    body: {
      estado: 'DEVUELTO',
    },
  });
}

export async function cancelLoan(loanId: string): Promise<void> {
  try {
    // Try dedicated cancel endpoint first
    await apiRequest(`/prestamos/${loanId}/cancelar/`, {
      method: 'POST',
    });
  } catch (error) {
    console.warn('Dedicated cancel endpoint failed, falling back to PATCH', error);
    // Fallback: use PATCH to set status to RECHAZADO
    await apiRequest(`/prestamos/${loanId}/`, {
      method: 'PATCH',
      body: { estado: 'RECHAZADO' },
    });
  }
}

export async function fetchSanctions(): Promise<Sanction[]> {
  const data = await apiRequest<BackendSancion[]>('/sanciones/');
  return data.map(mapSanction);
}

export async function fetchStudents(query: string = ''): Promise<User[]> {
  const url = query ? `/estudiantes/?search=${encodeURIComponent(query)}` : '/estudiantes/';
  const data = await apiRequest<any[]>(url);
  return data.map(u => ({
    id: String(u.id),
    email: u.email,
    name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username,
    role: u.is_staff ? 'admin' : 'student',
  }));
}

export async function createSanction(payload: {
  studentId: string;
  reason: string;
  severity: 'warning' | 'restriction' | 'ban';
  expiryDate?: Date;
  notes?: string;
}): Promise<Sanction> {
  const data = await apiRequest<BackendSancion>('/sanciones/', {
    method: 'POST',
    body: {
      estudiante: Number(payload.studentId),
      motivo: payload.reason,
      severidad: payload.severity,
      fecha_fin: payload.expiryDate ? payload.expiryDate.toISOString().slice(0, 10) : null,
      observaciones: payload.notes || null,
    },
  });

  return mapSanction(data);
}

export async function resolveSanction(sanctionId: string, notes?: string): Promise<Sanction> {
  const data = await apiRequest<BackendSancion>(`/sanciones/${sanctionId}/resolver/`, {
    method: 'PATCH',
    body: {
      observaciones: notes || null,
    },
  });

  return mapSanction(data);
}

export async function deleteSanction(sanctionId: string): Promise<void> {
  await apiRequest(`/sanciones/${sanctionId}/`, {
    method: 'DELETE',
  });
}

export async function downloadExcelReportFromApi(): Promise<{ blob: Blob; filename: string }> {
  const blob = await apiRequest<Blob>('/reportes/excel/', {
    responseType: 'blob',
  });

  return {
    blob,
    filename: `reporte-prestamos-${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function loginWithGoogleApi(credential: string): Promise<BackendLoginResponse> {
  return apiRequest<BackendLoginResponse>('/auth/google/', {
    method: 'POST',
    auth: false,
    body: { credential },
  });
}

export async function completarPerfilApi(carnet: string, carrera: string, ano_cursado: string): Promise<void> {
  await apiRequest('/auth/completar-perfil/', {
    method: 'POST',
    body: { carnet, carrera, ano_cursado },
  });
}

export async function procesarAtrasadosApi(): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>('/prestamos/procesar_atrasados/', {
    method: 'POST',
  });
}
