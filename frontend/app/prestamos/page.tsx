'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedLayout } from '@/components/protected-layout';
import { AppHeader } from '@/components/app-header';
import { EquipmentCardMinimal } from '@/components/equipment-card-minimal';
import { BorrowDialog } from '@/components/borrow-dialog';
import { Cart } from '@/components/cart';
import { CartConfirmationDrawer } from '@/components/cart-confirmation-drawer';
import { useCart, CartItem } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { fetchEquipment } from '@/lib/api-client';
import { Equipment } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Home, FileText, ShoppingCart, Search, Clock, User as UserIcon, ArrowLeft } from 'lucide-react';
import { isWarehouseOpen } from '@/lib/schedule';

function PrestamosPageContent() {
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'cart'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const warehouseStatus = useMemo(() => isWarehouseOpen(), []);

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

  const handleBorrow = (eq: Equipment & { variants?: Equipment[] }, manualChoose?: boolean) => {
    // Si el usuario presiona "Modelos", abrir el diálogo de selección de variantes
    if (manualChoose) {
      setSelectedEquipment(eq);
      setBorrowDialogOpen(true);
      return;
    }

    // Flujo 1-clic: agregar inmediatamente 1 unidad del modelo con stock disponible
    const variants = eq.variants || [eq];
    const availableVariant = variants.find(v => v.available > 0) || variants[0];
    
    if (availableVariant) {
      const item: CartItem = {
        id: String(availableVariant.id),
        name: availableVariant.marca_modelo 
          ? `${availableVariant.name} (${availableVariant.marca_modelo})` 
          : availableVariant.name,
        category: availableVariant.category,
        quantity: 1,
        equipment: availableVariant,
      };
      addToCart(item);
      setLastAddedItem(item);
      setDrawerOpen(true);
    }
  };

  const switchTab = (tab: 'catalog' | 'cart') => {
    setActiveTab(tab);
    router.replace(tab === 'cart' ? '/prestamos?view=cart' : '/prestamos');
  };

  const handleQuickAdd = (eq: Equipment) => {
    const item: CartItem = {
      id: String(eq.id),
      name: eq.marca_modelo ? `${eq.name} (${eq.marca_modelo})` : eq.name,
      category: eq.category,
      quantity: 1,
      equipment: eq,
    };
    addToCart(item);
    setLastAddedItem(item);
    setDrawerOpen(true);
  };

  const handleAddedItem = (item: CartItem) => {
    setLastAddedItem(item);
    setDrawerOpen(true);
  };

  const navItems = [
    { label: 'Inicio', href: '/dashboard', icon: <Home className="w-4 h-4" /> },
    { label: 'Catálogo', href: '/prestamos', icon: <ShoppingCart className="w-4 h-4" /> },
    { label: 'Mis Préstamos', href: '/dashboard/loans', icon: <FileText className="w-4 h-4" /> },
    { label: 'Mi Perfil', href: '/completar-perfil', icon: <UserIcon className="w-4 h-4" /> },
  ];

  return (
    <ProtectedLayout allowedRoles={['student']}>
      <AppHeader title="Catálogo de Equipos" navItems={navItems} />

      <main className="min-h-screen bg-background lg:pl-72">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 pb-mobile-nav">
            {!warehouseStatus.isOpen && (
              <div className="mb-6 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-center gap-3 text-amber-900 dark:text-amber-200 shadow-sm">
                <Clock className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold">Bodega de Deportes cerrada temporalmente</p>
                  <p className="opacity-90">Horario oficial de atención: <strong>{warehouseStatus.scheduleText}</strong>. Puedes seleccionar equipos en el carrito, pero la entrega se procesará en horario laboral.</p>
                </div>
              </div>
            )}

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
                      onBorrow={(_item, manualChoose) => handleBorrow(eq, manualChoose)}
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-border">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Tramitar Solicitud de Préstamo</h2>
                    <p className="text-sm text-muted-foreground">Revisa los artículos y confirma la fecha de devolución</p>
                  </div>
                  <button
                    onClick={() => switchTab('catalog')}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground rounded-xl hover:bg-muted transition-colors font-medium text-sm shrink-0 shadow-xs"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Seguir explorando catálogo
                  </button>
                </div>
                <div className="w-full">
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
        onAddedItem={handleAddedItem}
      />

      <CartConfirmationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lastAddedItem={lastAddedItem}
        onGoToCart={() => switchTab('cart')}
        allEquipment={equipment}
        onQuickAdd={handleQuickAdd}
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

