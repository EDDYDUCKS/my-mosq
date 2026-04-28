import { NextRequest, NextResponse } from 'next/server';

export function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp    = req.headers.get('x-real-ip');
  const detected  = forwarded?.split(',')[0].trim()
    ?? realIp
    ?? '127.0.0.1 (localhost)';

  return NextResponse.json({
    ip_detectada: detected,
    ip_permitida: process.env.ALLOWED_IPS ?? '208.96.129.55',
    acceso: detected === '127.0.0.1' || detected === '::1'
      ? 'PERMITIDO (localhost/desarrollo)'
      : (process.env.ALLOWED_IPS === '*' || (process.env.ALLOWED_IPS ?? '208.96.129.55').split(',').some(a =>
          a.endsWith('.') ? detected.startsWith(a) : detected === a.trim()
        )) ? 'PERMITIDO (red universidad)' : 'BLOQUEADO',
  });
}
