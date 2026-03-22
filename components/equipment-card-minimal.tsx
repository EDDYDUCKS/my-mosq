'use client';

import React from 'react';
import { Equipment } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  Dumbbell, 
  Wind, 
  Zap,
  Package
} from 'lucide-react';

interface EquipmentCardMinimalProps {
  equipment: Equipment;
  onBorrow?: (equipment: Equipment) => void;
}

export function EquipmentCardMinimal({ equipment, onBorrow }: EquipmentCardMinimalProps) {
  const isAvailable = equipment.available > 0;
  const availabilityPercentage = (equipment.available / equipment.total) * 100;

  const getIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('baloncesto') || lowerName.includes('basketball')) {
      return <Package className="w-12 h-12 text-green-600" />;
    }
    if (lowerName.includes('fútbol') || lowerName.includes('futbol') || lowerName.includes('soccer')) {
      return <Trophy className="w-12 h-12 text-green-600" />;
    }
    if (lowerName.includes('béisbol') || lowerName.includes('baseball')) {
      return <Zap className="w-12 h-12 text-green-600" />;
    }
    if (lowerName.includes('cono') || lowerName.includes('cone')) {
      return <Wind className="w-12 h-12 text-green-600" />;
    }
    if (lowerName.includes('guante') || lowerName.includes('glove')) {
      return <Dumbbell className="w-12 h-12 text-green-600" />;
    }
    return <Package className="w-12 h-12 text-green-600" />;
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-green-100 dark:border-green-900 h-full flex flex-col bg-white dark:bg-slate-950">
      {/* Icon Section */}
      <div className="h-32 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 flex items-center justify-center">
        {getIcon(equipment.name)}
      </div>

      {/* Content Section */}
      <CardContent className="flex-1 flex flex-col justify-between p-6">
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{equipment.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{equipment.category}</p>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">{equipment.description}</p>

          {/* Availability Indicator */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Disponibilidad</span>
              <span className={`text-xs font-bold ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                {equipment.available}/{equipment.total}
              </span>
            </div>
            <div className="w-full bg-green-100 dark:bg-green-900 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                style={{ width: `${Math.max(availabilityPercentage, 5)}%` }}
              />
            </div>
          </div>

          {/* Condition Badge */}
          <div className="flex gap-2 pt-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              equipment.condition === 'excellent'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                : equipment.condition === 'good'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
              {equipment.condition === 'excellent' && 'Excelente'}
              {equipment.condition === 'good' && 'Bueno'}
              {equipment.condition === 'fair' && 'Regular'}
            </span>
          </div>
        </div>

        {/* Button */}
        {onBorrow && (
          <Button
            onClick={() => onBorrow(equipment)}
            disabled={!isAvailable}
            className={`w-full mt-4 font-semibold transition-all duration-300 ${
              isAvailable
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isAvailable ? 'Agregar al Carrito' : 'No Disponible'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
