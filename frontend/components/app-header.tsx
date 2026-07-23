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
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#2d5a27] to-[#1e3a1a] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <div className="w-full px-3 sm:px-4 lg:px-6 h-16 sm:h-24 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Solo mostramos la hamburguesa a los admins en móvil */}
            {user?.role !== 'student' && (
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="p-2 rounded-lg hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 lg:hidden"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-md">
              <Image
                src="/ESTRELLASALLE.png"
                alt="Estrella La Salle"
                width={26}
                height={26}
                className="h-6 w-6 object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
                priority
              />
            </div>

            <div>
              <h1 className="text-xl sm:text-3xl font-black leading-none tracking-tight">MOSQ</h1>
              <p className="text-xs sm:text-sm text-white/75 truncate max-w-[150px] sm:max-w-none">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.14)] backdrop-blur-md">
            {showCartShortcut && (
              <Link
                href="/prestamos?view=cart"
                className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
                aria-label="Abrir carrito"
              >
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <span className="absolute right-0 top-0 flex h-5 min-w-5 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-white shadow-sm">
                    {cart.length > 9 ? '9+' : cart.length}
                  </span>
                )}
              </Link>
            )}

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Logout para móvil visible siempre en el header */}
            <button
              onClick={handleLogout}
              className="flex lg:hidden h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 text-red-300 hover:text-red-400 transition-colors"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/15 text-sm font-bold">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>

            <div className="hidden sm:flex flex-col text-left leading-tight">
              <span className="text-base font-semibold">{user?.name}</span>
              <span className="text-xs text-white/75 capitalize">{user?.role}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-24 h-[calc(100vh-6rem)] w-72 border-r border-border bg-background text-foreground z-40">
        <div className="h-full flex flex-col">
          <div className="px-6 pb-4">
            <p className="text-sm font-semibold text-muted-foreground">Navegación</p>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="px-4 py-4 border-t border-border">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </span>
              <span className="text-xs text-muted-foreground uppercase">{theme}</span>
            </button>

            <button
              onClick={handleLogout}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/15 px-3 py-2 text-sm font-medium text-destructive shadow-sm hover:bg-destructive/25"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-16 sm:top-24 z-50 flex lg:hidden">
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
