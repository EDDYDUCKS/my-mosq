export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  carnet?: string;
  carrera?: string;
  ano_cursado?: string;
  requiere_completar_perfil?: boolean;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<any>;
  refreshUser: () => Promise<User | null>;
  logout: () => void;
}

export interface Equipment {
  id: string;
  name: string;
  marca_modelo?: string;
  color?: string;
  category: string;
  description: string;
  available: number;
  total: number;
  maintenance?: number;
  imageUrl?: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'maintenance';
}

export interface LoanRequest {
  id: string;
  loanGroupId?: string;
  studentId: string;
  studentName: string;
  studentCardId?: string;
  studentCareer?: string;
  studentYear?: string;
  equipmentId: string;
  equipmentName: string;
  quantity: number;
  requestDate: Date;
  dueDate: Date;
  receivedAt?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'returned' | 'cancelado';
  backendStatus?: 'PENDIENTE' | 'ACTIVO' | 'DEVUELTO' | 'RECHAZADO' | 'CANCELADO' | 'ATRASADO' | 'PERDIDO';
  deliveredByName?: string;
  receivedByName?: string;
  notes?: string;
  motivo_rechazo?: string;
  solicitante_externo?: string | null;
  qr_token?: string;
  estado_devolucion?: 'BUENO' | 'DESGASTE' | 'DANADO';
  observaciones_devolucion?: string;
  foto_devolucion?: string;
}

export interface DashboardStats {
  top_equipos: Array<{ id: number; nombre: string; total: number }>;
  atrasos_por_carrera: Array<{ carrera: string; total: number }>;
  prestamos_por_mes: Array<{ mes: string; total: number }>;
  distribucion_estados: Record<string, number>;
  total_prestamos: number;
  total_equipos: number;
  total_estudiantes: number;
}

export interface Sanction {
  id: string;
  studentId: string;
  studentName: string;
  reason: string;
  date: Date;
  severity: 'warning' | 'restriction' | 'ban';
  expiryDate?: Date;
  notes?: string;
  isActive?: boolean;
  resolvedAt?: Date;
}

