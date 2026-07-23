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

import { GoogleLogin } from '@react-oauth/google';

export function LoginForm() {
  const router = useRouter();
  const { login, loginWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;



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

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('');
    if (!credentialResponse?.credential) {
      setError('No se obtuvo credencial de Google.');
      return;
    }

    try {
      const responsePayload = await loginWithGoogle(credentialResponse.credential);
      if (responsePayload.requiere_completar_perfil) {
        router.push('/completar-perfil');
        return;
      }
      
      if (responsePayload.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Error de Google o dominio inválido.');
    }
  };

  const handleGoogleError = () => {
    setError('El inicio de sesión con Google falló.');
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

                  <div className="flex justify-center w-full">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      useOneTap
                      theme="outline"
                      size="large"
                      text="continue_with"
                    />
                  </div>
                </div>
              </form>

            </CardContent>
          </Card>

          <p className="text-center text-xs text-white/70 md:text-muted-foreground mt-6 drop-shadow-md md:drop-shadow-none">
            Universidad Tecnológica La Salle © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
