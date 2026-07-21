// Servicio para generar reportes en Excel
// Usa CSV como alternativa a Excel para máxima compatibilidad

export interface LoanReportData {
  id: string;
  fecha: string;
  horaEntrega: string;
  horaDevolucion: string;
  numeroCarnet: string;
  nombreEstudiante: string;
  carrera: string;
  año: string;
  descripcionEquipo: string;
  cantidad: number;
  personaEntrega: string;
  personaRecibe: string;
  estado: string;
}

export function generateCSVReport(data: LoanReportData[]): string {
  const headers = [
    'ID',
    'Fecha',
    'Hora Entrega',
    'Hora Devolución',
    'Número Carnet',
    'Nombre Estudiante',
    'Carrera',
    'Año',
    'Descripción Equipo',
    'Cantidad',
    'Persona Entrega',
    'Persona Recibe',
    'Estado',
  ];

  const rows = data.map((item) => [
    item.id,
    item.fecha,
    item.horaEntrega,
    item.horaDevolucion,
    item.numeroCarnet,
    item.nombreEstudiante,
    item.carrera,
    item.año,
    item.descripcionEquipo,
    item.cantidad,
    item.personaEntrega,
    item.personaRecibe,
    item.estado,
  ]);

  const csvContent = [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

export function downloadReport(csvContent: string, filename: string = 'reporte-prestamos.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateExcelReport(data: LoanReportData[]): string {
  // Genera un formato HTML que Excel puede abrir
  const headers = [
    'ID',
    'Fecha',
    'Hora Entrega',
    'Hora Devolución',
    'Número Carnet',
    'Nombre Estudiante',
    'Carrera',
    'Año',
    'Descripción Equipo',
    'Cantidad',
    'Persona Entrega',
    'Persona Recibe',
    'Estado',
  ];

  let html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h2>Reporte de Préstamos de Equipos Deportivos</h2>
        <p>Generado: ${new Date().toLocaleString('es-NI')}</p>
        <table>
          <thead>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                (item) => `
              <tr>
                <td>${item.id}</td>
                <td>${item.fecha}</td>
                <td>${item.horaEntrega}</td>
                <td>${item.horaDevolucion}</td>
                <td>${item.numeroCarnet}</td>
                <td>${item.nombreEstudiante}</td>
                <td>${item.carrera}</td>
                <td>${item.año}</td>
                <td>${item.descripcionEquipo}</td>
                <td>${item.cantidad}</td>
                <td>${item.personaEntrega}</td>
                <td>${item.personaRecibe}</td>
                <td>${item.estado}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  return html;
}

export function downloadExcelReport(
  htmlContent: string,
  filename: string = 'reporte-prestamos.xls'
) {
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
