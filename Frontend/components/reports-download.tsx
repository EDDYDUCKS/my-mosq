'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText } from 'lucide-react';
import { generateCSVReport, downloadReport } from '@/lib/report-service';
import { downloadBlob, downloadExcelReportFromApi, fetchAdminLoans } from '@/lib/api-client';
import { useNotifications } from '@/lib/notifications-context';

export function ReportsDownload() {
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotifications();

  const handleDownloadExcel = () => {
    setIsLoading(true);
    (async () => {
      try {
        const { blob, filename } = await downloadExcelReportFromApi();
        downloadBlob(blob, filename);

        addNotification(
          'Reporte Descargado',
          'El reporte en Excel ha sido descargado exitosamente',
          'success'
        );
      } catch (error) {
        addNotification(
          'Error',
          'No se pudo descargar el reporte',
          'error'
        );
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const handleDownloadCSV = () => {
    setIsLoading(true);
    (async () => {
      try {
        const loans = await fetchAdminLoans();
        const reportData = loans.map((request) => ({
          id: request.id,
          fecha: new Date(request.requestDate).toLocaleDateString('es-NI'),
          horaEntrega: new Date(request.requestDate).toLocaleTimeString('es-NI'),
          horaDevolucion: request.receivedAt
            ? new Date(request.receivedAt).toLocaleTimeString('es-NI')
            : 'Pendiente',
          numeroCarnet: request.studentCardId || 'N/D',
          nombreEstudiante: request.studentName,
          carrera: request.studentCareer || 'N/D',
          año: request.studentYear || 'N/D',
          descripcionEquipo: request.equipmentName,
          cantidad: request.quantity,
          personaEntrega: request.deliveredByName || 'N/D',
          personaRecibe: request.receivedByName || 'Pendiente',
          estado: request.backendStatus || request.status,
        }));

        const csvContent = generateCSVReport(reportData);
        const timestamp = new Date().toISOString().slice(0, 10);
        downloadReport(csvContent, `reporte-prestamos-${timestamp}.csv`);

        addNotification(
          'Reporte Descargado',
          'El reporte en CSV ha sido descargado exitosamente',
          'success'
        );
      } catch (error) {
        addNotification(
          'Error',
          'No se pudo descargar el reporte',
          'error'
        );
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <Card className="border border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-slate-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <FileText className="w-5 h-5" />
          Descargar Reportes
        </CardTitle>
        <CardDescription>
          Descarga reportes de préstamos en diferentes formatos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={handleDownloadExcel}
            disabled={isLoading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold transition-all"
          >
            <Download className="w-4 h-4" />
            Descargar Excel
          </Button>
          <Button
            onClick={handleDownloadCSV}
            disabled={isLoading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold transition-all"
          >
            <Download className="w-4 h-4" />
            Descargar CSV
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Los reportes incluyen: fecha, hora de entrega/devolución, número de carnet, nombre del estudiante, carrera, año, descripción del equipo, cantidad, persona que entrega y recibe.
        </p>
      </CardContent>
    </Card>
  );
}
