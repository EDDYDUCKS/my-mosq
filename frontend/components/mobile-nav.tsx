'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ShoppingCart, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { cart } = useCart();

  // No mostrar la barra si no hay usuario, si es admin, o si debe completar su perfil
  if (!user || user.role === 'admin' || user.requiere_completar_perfil || pathname === '/completar-perfil') {
    return null;
  }

  // RUTAS DEL ESTUDIANTE (ajustar si las rutas cambian)
  const links = [
    { href: '/dashboard',  icon: Home,          label: 'Inicio'   },
    { href: '/prestamos',  icon: Search,         label: 'Catálogo' },
    { href: '/prestamos?view=cart', icon: ShoppingCart, label: 'Carrito', badge: cart.length },
    { href: '/dashboard/loans',    icon: User,         label: 'Mis Pedidos' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] safe-area-pb">
      <div className="flex justify-around items-center h-16 px-2">
        {links.map((link) => {
          const isActive = link.href === '/dashboard' || link.href === '/prestamos'
            ? pathname === link.href
            : pathname.startsWith(link.href.split('?')[0]);
            
          const Icon = link.icon;
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1.5 space-y-1 relative transition-all ${
                isActive ? 'text-[#1b4931] dark:text-emerald-400 font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.6]'}`} />
                {link.badge !== undefined && link.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2.5 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full ring-2 ring-background animate-in zoom-in">
                    {link.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] tracking-tight ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
