'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { 
  LogOut, 
  Menu,
  X,
  Moon,
  Sun,
  ShoppingCart
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface AppHeaderProps {
  title: string;
  navItems: NavItem[];
}

export function AppHeader({ title, navItems }: AppHeaderProps) {
  const { logout, user } = useAuth();
  const { cart } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showCartShortcut = user?.role === 'student';

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0f2537]/90 backdrop-blur-md text-white border-b border-white/10 shadow-sm transition-all">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Botón menú móvil para administradores */}
            {user?.role !== 'student' && (
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 lg:hidden transition-colors"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 shadow-inner backdrop-blur-sm">
                <Image
                  src="/ESTRELLASALLE.png"
                  alt="Estrella La Salle"
                  width={24}
                  height={24}
                  className="h-5 w-5 object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }}
                  priority
                />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black tracking-wider leading-none text-white">MOSQ</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">ULSA</span>
                </div>
                <p className="text-[11px] font-medium text-white/60 truncate max-w-[150px] sm:max-w-none mt-0.5">
                  {title}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {showCartShortcut && (
              <Link
                href="/prestamos?view=cart"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/90 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                aria-label="Abrir carrito"
              >
                <ShoppingCart className="w-4 h-4" />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[#0f2537]">
                    {cart.length > 9 ? '9+' : cart.length}
                  </span>
                )}
              </Link>
            )}

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Logout móvil siempre accesible en el header */}
            <button
              onClick={handleLogout}
              className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-red-300 hover:bg-red-500/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>

            <div className="hidden sm:flex items-center gap-2.5 pl-2 ml-1 border-l border-white/10">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-xs font-bold text-white shadow-inner">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </div>

              <div className="flex flex-col text-left leading-tight">
                <span className="text-xs font-semibold text-white/95">{user?.name}</span>
                <span className="text-[10px] text-white/60 uppercase tracking-wider">{user?.role}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 border-r border-border bg-card/60 backdrop-blur-xl text-foreground z-40">
        <div className="h-full flex flex-col justify-between w-full">
          <div className="p-4 space-y-4">
            <div className="px-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Navegación</p>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#1b4931] text-white shadow-sm shadow-[#1b4931]/20 font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-muted-foreground'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-border bg-muted/10 space-y-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium hover:bg-muted transition-colors text-foreground"
            >
              <span className="flex items-center gap-2.5">
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">{theme}</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-sm font-semibold text-destructive shadow-sm hover:bg-destructive/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>

            <div className="pt-3 pb-1 text-center text-[10px] text-muted-foreground/75 leading-tight border-t border-border/50 select-none">
              <p className="font-semibold text-muted-foreground tracking-wider uppercase">MOSQ · ULSA</p>
              <p className="mt-1">
                Desarrollado por <span className="font-semibold text-foreground/80">Eddy Martínez</span> & <span className="font-semibold text-foreground/80">Cristoffer Betancourt</span>
              </p>
            </div>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-full bg-background shadow-xl border-r border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <p className="text-lg font-semibold text-foreground">Menú</p>
                <p className="text-xs text-muted-foreground">Navegación rápida</p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-muted"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 transition-colors ${
                    pathname === item.href
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-border space-y-2">
              <button
                onClick={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-muted text-foreground"
              >
                <span className="flex items-center gap-2">
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                </span>
                <span className="text-xs text-muted-foreground uppercase">{theme}</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/15 px-3 py-2 text-destructive shadow-sm hover:bg-destructive/25"
              >
                <LogOut className="w-5 h-5" />
                Cerrar Sesión
              </button>

              <div className="pt-3 pb-1 text-center text-[10px] text-muted-foreground/75 leading-tight border-t border-border/50 select-none">
                <p className="font-semibold text-muted-foreground tracking-wider uppercase">MOSQ · ULSA</p>
                <p className="mt-1">
                  Desarrollado por <span className="font-semibold text-foreground/80">Eddy Martínez</span> & <span className="font-semibold text-foreground/80">Cristoffer Betancourt</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
