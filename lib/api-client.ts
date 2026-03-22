import { Equipment, LoanRequest, User } from '@/lib/types';

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
  descripcion: string | null;
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
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  fecha_prestamo: string;
  fecha_devolucion: string | null;
  estado: 'ACTIVO' | 'DEVUELTO' | 'ATRASADO';
  detalles: BackendDetallePrestamo[];
}

interface BackendLoginResponse {
  token: string;
  user: User;
}

function toPublicPath(fileName: string): string {
  return encodeURI(`/${fileName}`);
}

function resolveEquipmentImage(name: string): string {
  const normalizedName = name.toLowerCase();

  if (
    normalizedName.includes('red')
    && (normalizedName.includes('futbol') || normalizedName.includes('fútbol'))
  ) {
    return toPublicPath('reddefutbol.png');
  }

  if (normalizedName.includes('guante') && (normalizedName.includes('futbol') || normalizedName.includes('fútbol'))) {
    return toPublicPath('guantefutbol.png');
  }

  if (
    normalizedName.includes('baloncesto')
    || normalizedName.includes('basket')
    || normalizedName.includes('basquet')
    || normalizedName.includes('básquet')
    || normalizedName.includes('pelota de basket')
    || normalizedName.includes('pelota de basquet')
    || normalizedName.includes('pelota de básquet')
    || normalizedName.includes('balon de basket')
    || normalizedName.includes('balón de basket')
    || normalizedName.includes('balon de basquet')
    || normalizedName.includes('balón de basquet')
    || normalizedName.includes('balon de básquet')
    || normalizedName.includes('balón de básquet')
  ) {
    return toPublicPath('basketball.png');
  }

  if (
    normalizedName.includes('softball')
    || normalizedName.includes('softbol')
    || normalizedName.includes('pelota de softball')
    || normalizedName.includes('pelota de softbol')
    || normalizedName.includes('bola softball')
    || normalizedName.includes('bola de softball')
    || normalizedName.includes('bola de softbol')
  ) {
    return toPublicPath('bolasoftball.png');
  }

  if (normalizedName.includes('futbol') || normalizedName.includes('fútbol')) {
    return toPublicPath('balonfutbol.png');
  }

  if (normalizedName.includes('beisbol') || normalizedName.includes('béisbol')) {
    if (normalizedName.includes('bate')) {
      return toPublicPath('batebeisbol.png');
    }

    if (normalizedName.includes('guante')) {
      return toPublicPath('guantebeisbol.png');
    }

    if (normalizedName.includes('proteccion') || normalizedName.includes('protección')) {
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

  if (
    normalizedName.includes('volley')
    || normalizedName.includes('voleibol')
    || normalizedName.includes('volleyball')
    || normalizedName.includes('pelota de volley')
    || normalizedName.includes('pelora de volley')
  ) {
    if (normalizedName.includes('pelota') || normalizedName.includes('pelora') || normalizedName.includes('balon') || normalizedName.includes('balón')) {
      return toPublicPath('bolaVolleyball.png');
    }
    return toPublicPath('redvolley.png');
  }

  if (normalizedName.includes('tablero')) {
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

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
    category: 'General',
    description: item.descripcion || 'Sin descripción',
    available: item.cantidad_disponible,
    total: item.cantidad_total,
    imageUrl: resolveEquipmentImage(item.nombre),
    condition: 'good',
  };
}

function mapLoanStatus(status: BackendPrestamo['estado']): LoanRequest['status'] {
  if (status === 'DEVUELTO') return 'returned';
  if (status === 'ATRASADO') return 'pending';
  return 'approved';
}

function mapLoans(prestamos: BackendPrestamo[]): LoanRequest[] {
  return prestamos.flatMap((prestamo) => {
    const studentName = `${prestamo.estudiante_detalle?.first_name || ''} ${prestamo.estudiante_detalle?.last_name || ''}`.trim()
      || prestamo.estudiante_detalle?.username
      || 'Estudiante';

    return prestamo.detalles.map((detalle) => ({
      id: `${prestamo.id}-${detalle.id}`,
      loanGroupId: String(prestamo.id),
      studentId: String(prestamo.estudiante),
      studentName,
      equipmentId: String(detalle.equipo),
      equipmentName: detalle.equipo_detalle?.nombre || `Equipo #${detalle.equipo}`,
      quantity: detalle.cantidad,
      requestDate: new Date(prestamo.fecha_prestamo),
      dueDate: new Date(prestamo.fecha_devolucion || prestamo.fecha_prestamo),
      status: mapLoanStatus(prestamo.estado),
      backendStatus: prestamo.estado,
    }));
  });
}

export async function loginWithApi(email: string, password: string): Promise<BackendLoginResponse> {
  return apiRequest<BackendLoginResponse>('/auth/login/', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
}

export async function fetchCurrentUser(): Promise<User> {
  return apiRequest<User>('/auth/me/');
}

export async function fetchEquipment(): Promise<Equipment[]> {
  const data = await apiRequest<BackendEquipo[]>('/equipos/', { auth: false });
  return data.map(mapEquipment);
}

export async function createEquipment(payload: {
  nombre: string;
  descripcion?: string;
  cantidad_total: number;
  cantidad_disponible: number;
}): Promise<Equipment> {
  const data = await apiRequest<BackendEquipo>('/equipos/', {
    method: 'POST',
    body: payload,
  });

  return mapEquipment(data);
}

export async function updateEquipment(
  equipmentId: string,
  payload: {
    nombre: string;
    descripcion?: string;
    cantidad_total: number;
    cantidad_disponible: number;
  },
): Promise<Equipment> {
  const data = await apiRequest<BackendEquipo>(`/equipos/${equipmentId}/`, {
    method: 'PUT',
    body: payload,
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
  estado?: 'ACTIVO';
  detalles: Array<{ equipo: number; cantidad: number }>;
}): Promise<void> {
  await apiRequest('/prestamos/', {
    method: 'POST',
    body: {
      ...payload,
      estado: payload.estado || 'ACTIVO',
    },
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
