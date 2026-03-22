'use client';

import Image from 'next/image';
import React from 'react';
import { Equipment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-context';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

interface EquipmentCardProps {
  equipment: Equipment;
  onBorrow?: (equipment: Equipment) => void;
}

export function EquipmentCard({ equipment, onBorrow }: EquipmentCardProps) {
  const isAvailable = equipment.available > 0;
  const availabilityPercentage = (equipment.available / equipment.total) * 100;
  const { addToCart, cart } = useCart();
  const isInCart = cart.some((item) => item.id === equipment.id);

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'good':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'fair':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const imageSrc = equipment.imageUrl || '/placeholder.jpg';
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col py-0 gap-0">
      <div className="relative w-full h-40 bg-[#e9edf0]">
        <Image
          src={imageSrc}
          alt={equipment.name}
          fill
          className="object-contain p-2"
        />
        <div className="absolute bottom-3 left-3 rounded-full bg-black/40 px-3 py-1 text-xs text-white">
          {equipment.category}
        </div>
      </div>

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg">{equipment.name}</CardTitle>
            <CardDescription className="text-sm mt-1">{equipment.category}</CardDescription>
          </div>
          <Badge className={getConditionColor(equipment.condition)}>
            {equipment.condition === 'excellent' && 'Excelente'}
            {equipment.condition === 'good' && 'Bueno'}
            {equipment.condition === 'fair' && 'Regular'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{equipment.description}</p>

          {/* Availability Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Disponibilidad</span>
              <span className={`text-xs font-bold ${isAvailable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {equipment.available}/{equipment.total}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  availabilityPercentage > 50
                    ? 'bg-green-500'
                    : availabilityPercentage > 25
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(availabilityPercentage, 5)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          {onBorrow && (
            <Button
              onClick={() => onBorrow(equipment)}
              disabled={!isAvailable}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isAvailable ? 'Agregar al Carrito' : 'No Disponible'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
