'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader } from 'lucide-react';

import { AdminNotifications } from '@/components/admin-notifications';

interface ProtectedLayoutProps {
  children: React.ReactNode;
  allowedRoles?: ('student' | 'admin')[];
}

export function ProtectedLayout({ children, allowedRoles }: ProtectedLayoutProps) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    } else if (!loading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      router.push('/');
    } else if (!loading && user && user.role !== 'admin' && user.requiere_completar_perfil) {
      router.replace('/completar-perfil');
    }
  }, [user, loading, router, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Estudiante con perfil incompleto: NUNCA mostrar la pantalla protegida
  if (user.role !== 'admin' && user.requiere_completar_perfil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">Redirigiendo para completar tu perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {user.role === 'admin' && <AdminNotifications />}
      {children}
    </>
  );
}
