'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { EquipmentCardMinimal } from '@/components/equipment-card-minimal';
import { BorrowDialog } from '@/components/borrow-dialog';
import { Cart } from '@/components/cart';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { fetchEquipment } from '@/lib/api-client';
import { Equipment } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Home, FileText, ShoppingCart, Search } from 'lucide-react';

function PrestamosPageContent() {
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'catalog' | 'cart'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  useCart();

  useEffect(() => {
    const view = searchParams.get('view');
    setActiveTab(view === 'cart' ? 'cart' : 'catalog');
  }, [searchParams]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const equipmentData = await fetchEquipment();
        if (!isMounted) return;
        setEquipment(equipmentData);
      } catch {
        if (!isMounted) return;
        setEquipment([]);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };
    if (user) loadData();
    else setLoadingData(false);
    return () => { isMounted = false; };
  }, [user]);

  const groupedEquipment = useMemo(() => {
    const groups = new Map<string, Equipment & { variants: Equipment[] }>();
    equipment.forEach(eq => {
      if (groups.has(eq.name)) {
        const existing = groups.get(eq.name)!;
        existing.available += eq.available;
        existing.total += eq.total;
        existing.variants.push(eq);
      } else {
        groups.set(eq.name, { ...eq, variants: [eq] });
      }
    });
    
    const arrayGroups = Array.from(groups.values());
    
    // Filtrar por la búsqueda si existe
    if (!searchQuery.trim()) return arrayGroups;
    
    const lowerQuery = searchQuery.toLowerCase();
    return arrayGroups.filter(eq => 
      eq.name.toLowerCase().includes(lowerQuery) || 
      (eq.description && eq.description.toLowerCase().includes(lowerQuery))
    );
  }, [equipment, searchQuery]);

  const handleBorrow = (eq: Equipment & { variants?: Equipment[] }) => {
    setSelectedEquipment(eq);
    setBorrowDialogOpen(true);
  };

  const switchTab = (tab: 'catalog' | 'cart') => {
    setActiveTab(tab);
    router.replace(tab === 'cart' ? '/prestamos?view=cart' : '/prestamos');
  };

  const navItems = [
    { label: 'Inicio', href: '/dashboard', icon: <Home className="w-4 h-4" /> },
    { label: 'Catálogo', href: '/prestamos', icon: <ShoppingCart className="w-4 h-4" /> },
    { label: 'Mis Préstamos', href: '/dashboard/loans', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <ProtectedLayout allowedRoles={['student']}>
      <AppHeader title="Catálogo de Equipos" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-mobile-nav">
            {activeTab === 'catalog' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Equipo Disponible</h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      Selecciona un equipo para agregarlo al carrito
                    </p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre o descripción..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {groupedEquipment.map((eq) => (
                    <EquipmentCardMinimal
                      key={eq.id}
                      equipment={eq as Equipment}
                      onBorrow={() => handleBorrow(eq)}
                    />
                  ))}
                  {!loadingData && groupedEquipment.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                      {searchQuery ? (
                        <>No se encontraron equipos que coincidan con "<strong>{searchQuery}</strong>".</>
                      ) : (
                        <>No hay equipos disponibles en este momento.</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'cart' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Mi Carrito de Préstamo</h2>
                    <p className="text-sm text-muted-foreground">Revisa y envía tu solicitud de préstamo</p>
                  </div>
                  <button
                    onClick={() => switchTab('catalog')}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm shrink-0"
                  >
                    ← Volver al Catálogo
                  </button>
                </div>
                <div className="max-w-2xl">
                  <Cart />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <BorrowDialog
        equipment={selectedEquipment}
        open={borrowDialogOpen}
        onOpenChange={setBorrowDialogOpen}
      />
    </ProtectedLayout>
  );
}

export default function PrestamosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <PrestamosPageContent />
    </Suspense>
  );
}

