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

  // No mostrar la barra si no hay usuario o si es admin
  if (!user || user.role === 'admin') return null;

  // RUTAS DEL ESTUDIANTE (ajustar si las rutas cambian)
  const links = [
    { href: '/dashboard',  icon: Home,          label: 'Inicio'   },
    { href: '/prestamos',  icon: Search,         label: 'Catálogo' },
    { href: '/prestamos?view=cart', icon: ShoppingCart, label: 'Carrito', badge: cart.length },
    { href: '/dashboard/loans',    icon: User,         label: 'Mis Pedidos' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border shadow-[0_-4px_10px_rgba(0,0,0,0.05)] safe-area-pb">
      <div className="flex justify-around items-center h-16">
        {links.map((link) => {
          const isActive = link.href === '/dashboard' || link.href === '/prestamos'
      ? pathname === link.href
      : pathname.startsWith(link.href.split('?')[0]);
            
          const Icon = link.icon;
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative transition-colors ${
                isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground hover:text-green-600/80'
              }`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110 stroke-2' : 'stroke-[1.5]'}`} />
                {link.badge !== undefined && link.badge > 0 ? (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-in zoom-in">
                    {link.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
