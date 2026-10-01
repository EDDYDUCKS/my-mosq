'use client';

import React from 'react';
import { Equipment } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { resolveEquipmentImage } from '@/lib/api-client';

interface EquipmentCardMinimalProps {
  equipment: Equipment;
  onBorrow?: (equipment: Equipment, manualChoose?: boolean) => void;
}

export function EquipmentCardMinimal({ equipment, onBorrow }: EquipmentCardMinimalProps) {
  const isAvailable = equipment.available > 0;
  const availabilityPercentage = (equipment.available / equipment.total) * 100;
  const imageSrc = equipment.imageUrl || '/placeholder.jpg';
  return (
    <Card className="overflow-hidden hover:shadow-md hover:border-[#1b4931]/30 transition-all duration-200 border-border/80 h-full flex flex-col bg-card rounded-2xl py-0 gap-0 group">
      {/* Image Section */}
      <div className="relative h-36 bg-[#f1f5f9] dark:bg-muted/30 border-b border-border/60">
        {/* img estándar con fallback: si el archivo en Render fue borrado, cae al ícono local */}
        <img
          src={imageSrc}
          alt={equipment.name}
          className="absolute inset-0 w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            const fallback = resolveEquipmentImage(equipment.name);
            if (e.currentTarget.src !== window.location.origin + fallback) {
              e.currentTarget.src = fallback;
            }
          }}
        />
        <div className="absolute top-2.5 right-2.5">
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border backdrop-blur-sm flex items-center gap-1.5 ${
            isAvailable
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-600' : 'bg-red-600'}`} />
            {isAvailable ? `${equipment.available} disp.` : 'Agotado'}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <CardContent className="flex-1 flex flex-col justify-between p-5">
        <div className="space-y-2.5">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground/80">{equipment.category}</span>
            <h3 className="text-base font-bold text-foreground leading-tight mt-0.5">{equipment.name}</h3>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{equipment.description}</p>

          {/* Availability Indicator */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">En bodega:</span>
              <span className="font-semibold text-foreground">
                {equipment.available} de {equipment.total} unidades
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-[#1b4931] dark:bg-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(availabilityPercentage, 5)}%` }}
              />
            </div>
          </div>

          {/* Condition Badge */}
          <div className="flex gap-2 pt-1">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
              equipment.condition === 'excellent'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : equipment.condition === 'good'
                ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
            }`}>
              Condición: {equipment.condition === 'excellent' ? 'Excelente' : equipment.condition === 'good' ? 'Buena' : 'Regular'}
            </span>
          </div>
        </div>

        {/* Button */}
        {onBorrow && (
          <div className="mt-4 flex items-center gap-1.5">
            <Button
              onClick={() => onBorrow(equipment)}
              disabled={!isAvailable}
              className={`flex-1 h-10 text-xs font-semibold rounded-xl shadow-xs transition-all ${
                isAvailable
                  ? 'bg-[#1b4931] hover:bg-[#163c28] text-white active:scale-98'
                  : 'bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted'
              }`}
            >
              {isAvailable ? 'Solicitar (+1)' : 'No Disponible'}
            </Button>
            {isAvailable && (equipment as any).variants && (equipment as any).variants.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onBorrow(equipment, true);
                }}
                className="h-10 px-2.5 text-[11px] font-medium border-border hover:bg-muted text-muted-foreground rounded-xl"
                title="Elegir marca o modelo específico"
              >
                Modelos
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
