'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateCSVReport, downloadReport } from '@/lib/report-service';
import { downloadBlob, downloadExcelReportFromApi, fetchAdminLoans } from '@/lib/api-client';
import { useNotifications } from '@/lib/notifications-context';

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getMesStr(year: number, month: number): string {
  // month es 1-indexed
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function ReportsDownload() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotifications();

  const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);
  const mesStr = getMesStr(year, month);
  const mesLabel = `${MESES_ES[month - 1]} ${year}`;

  const goToPrevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else             { setMonth(m => m - 1); }
  };

  const goToNextMonth = () => {
    if (isCurrentMonth) return; // no ir a futuro
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else              { setMonth(m => m + 1); }
  };

  const handleDownloadExcel = () => {
    setIsLoading(true);
    (async () => {
      try {
        const { blob, filename } = await downloadExcelReportFromApi(mesStr);
        downloadBlob(blob, filename);
        // Marcar el mes actual como "reporte descargado"
        localStorage.setItem('mosq_last_report_month', getMesStr(now.getFullYear(), now.getMonth() + 1));
        addNotification('Reporte Descargado', `Reporte Excel de ${mesLabel} descargado.`, 'success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'No se pudo descargar el reporte Excel.';
        addNotification('Error', message, 'error');
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
        // Filtrar por mes seleccionado (todos los estados)
        const filtrados = loans.filter(loan => {
          const d = new Date(loan.requestDate);
          return d.getFullYear() === year && (d.getMonth() + 1) === month;
        });
        const reportData = filtrados.map((request) => ({
          id:                request.loanGroupId || request.id,
          fecha:             new Date(request.requestDate).toLocaleDateString('es-NI'),
          horaEntrega:       new Date(request.requestDate).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }),
          horaDevolucion:    request.receivedAt ? new Date(request.receivedAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : 'Pendiente',
          numeroCarnet:      request.studentCardId || 'N/D',
          nombreEstudiante:  request.studentName,
          carrera:           request.studentCareer || 'N/D',
          año:               request.studentYear || 'N/D',
          descripcionEquipo: request.equipmentName,
          cantidad:          request.quantity,
          personaEntrega:    request.deliveredByName || 'N/D',
          personaRecibe:     request.receivedByName || 'N/D',
          estado:            request.backendStatus || request.status,
        }));

        const csvContent = generateCSVReport(reportData);
        downloadReport(csvContent, `Reporte_Prestamos_${mesLabel.replace(' ', '_')}.csv`);
        localStorage.setItem('mosq_last_report_month', getMesStr(now.getFullYear(), now.getMonth() + 1));
        addNotification('Reporte Descargado', `Reporte CSV de ${mesLabel} descargado.`, 'success');
      } catch {
        addNotification('Error', 'No se pudo descargar el reporte CSV.', 'error');
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
          Reportes de Préstamos
        </CardTitle>
        <CardDescription>
          Descarga los reportes mensuales de préstamos e inventario general
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Selector de mes */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Período</p>
          <div className="flex items-center justify-between gap-3 bg-muted/50 rounded-lg px-4 py-2.5 border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevMonth}
              disabled={isLoading}
              className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="text-center">
              <p className="font-semibold text-foreground text-sm">{mesLabel}</p>
              {isCurrentMonth && (
                <p className="text-xs text-green-600 dark:text-green-400">Mes actual</p>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextMonth}
              disabled={isLoading || isCurrentMonth}
              className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Botones de descarga */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            onClick={handleDownloadExcel}
            disabled={isLoading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold transition-all"
          >
            <Download className="w-4 h-4" />
            {isLoading ? 'Generando...' : 'Descargar Excel'}
          </Button>
          <Button
            onClick={handleDownloadCSV}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2 border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950 font-semibold transition-all"
          >
            <Download className="w-4 h-4" />
            {isLoading ? 'Generando...' : 'Descargar CSV'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          El archivo Excel contiene <strong>2 pestañas</strong>: 1) Préstamos del mes (todos los estados con resumen KPI) y 2) Inventario completo de equipos en bodega.
        </p>
      </CardContent>
    </Card>
  );
}
