'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Globe } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

declare global {
  interface Window {
    google?: any;
  }
}

export function LoginForm() {
  const router = useRouter();
  const { login, loginWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId) return;
    if (typeof window === 'undefined') return;
    if (window.google?.accounts?.id) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.id = 'google-identity';
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [googleClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.endsWith('@ulsa.edu.ni')) {
      setError('Por favor usa tu correo institucional (@ulsa.edu.ni)');
      return;
    }

    try {
      const user = await login(email, password);
      if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Email o contraseña incorrectos en el backend.');
    }
  };

  const handleGoogleLogin = () => {
    setError('');

    if (!googleClientId) {
      setError('Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID en el entorno.');
      return;
    }

    if (!window.google?.accounts?.id) {
      setError('Google Identity aún no está listo. Recarga la página e inténtalo de nuevo.');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: any) => {
        if (!response?.credential) {
          setError('No se obtuvo credencial de Google.');
          return;
        }

        try {
          const user = await loginWithGoogle(response.credential);
          if (user.role === 'admin') {
            router.push('/admin');
          } else {
            router.push('/dashboard');
          }
        } catch (err) {
          setError('Google no está habilitado en backend todavía. Usa correo y contraseña.');
        }
      },
    });

    window.google.accounts.id.prompt();
  };

  return (
    <div className="relative min-h-screen bg-background flex">
      <div className="absolute inset-0 md:hidden">
        <Image src="/ulsa-campus.png" alt="Campus ULSA" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black/45" />
      </div>

      <div className="relative hidden md:flex w-1/2 overflow-hidden">
        <Image src="/ulsa-campus.png" alt="Campus ULSA" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 px-8 text-center">
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 mb-4">
              <Image src="/ESTRELLASALLE.png" alt="Estrella La Salle" width={48} height={48} />
            </div>
            <h1 className="text-3xl font-bold text-white md:text-foreground mb-2">MOSQ</h1>
            <p className="text-xl text-white md:text-foreground">Sistema de Gestión de Préstamos de Equipos Deportivos</p>
          </div>

          <Card className="border-border shadow-lg bg-background/95 backdrop-blur-sm md:bg-card md:backdrop-blur-0">
            <CardHeader>
              <CardTitle>Iniciar Sesión</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Correo Institucional</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="estudiante@ulsa.edu.ni"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="bg-muted border-border"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="bg-muted border-border"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={loading}
                >
                  {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                </Button>

                <div className="mt-3">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-2">
                    <span className="h-px flex-1 bg-border" />
                    <span>o</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={handleGoogleLogin}
                  >
                    <Globe className="w-4 h-4" />
                    Acceder con Google
                  </Button>
                </div>
              </form>

              <div className="mt-6 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Usa tus credenciales reales del backend para acceder.
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Universidad Tecnológica La Salle © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
