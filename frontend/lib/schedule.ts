/**
 * Verifica si la hora actual en la zona horaria de Nicaragua (UTC-6)
 * cae dentro del horario de atención operativo de la bodega de deportes:
 * Lunes a Sábado de 7:00 AM a 7:00 PM (19:00).
 */
export function isWarehouseOpen(): { isOpen: boolean; scheduleText: string } {
  const scheduleText = 'Lunes a Sábado de 7:00 AM a 7:00 PM';
  
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Managua',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);

  let weekdayStr = '';
  let hour = 0;

  for (const part of parts) {
    if (part.type === 'weekday') weekdayStr = part.value; // Mon, Tue, ..., Sun
    if (part.type === 'hour') hour = parseInt(part.value, 10);
  }

  const isSunday = weekdayStr.toLowerCase().startsWith('sun');

  if (isSunday || hour < 7 || hour >= 19) {
    return { isOpen: false, scheduleText };
  }

  return { isOpen: true, scheduleText };
}
