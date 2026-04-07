export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  logout: () => void;
}

export interface Equipment {
  id: string;
  name: string;
  category: string;
  description: string;
  available: number;
  total: number;
  imageUrl: string;
  condition: 'excellent' | 'good' | 'fair';
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
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  backendStatus?: 'PENDIENTE' | 'ACTIVO' | 'DEVUELTO' | 'RECHAZADO' | 'ATRASADO';
  deliveredByName?: string;
  receivedByName?: string;
  notes?: string;
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
