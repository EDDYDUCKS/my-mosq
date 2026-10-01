import { NextRequest, NextResponse } from 'next/server';

// ── IPs/rangos permitidos ──────────────────────────────────────────────────
// Si no está definido o es '*', el acceso es abierto para estudiantes y personal
const RAW = process.env.ALLOWED_IPS ?? '*';
const ALLOWED = RAW.split(',').map(s => s.trim()).filter(Boolean);

// ── Cookie de bypass ─────────────────────────────────────────────────────
const BYPASS_COOKIE = 'mosq_bypass';
const BYPASS_TOKEN  = process.env.BYPASS_TOKEN || '';

// Rutas que NO necesitan verificación
const PUBLIC_PATHS = ['/', '/sin-acceso', '/login', '/_next', '/favicon', '/ESTRELLASALLE', '/manifest.json'];

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

function isAllowed(ip: string): boolean {
  if (ALLOWED.includes('*') || ALLOWED.length === 0) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.')) return true;
  return ALLOWED.some(allowed =>
    allowed.endsWith('.') ? ip.startsWith(allowed) : ip === allowed
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Dejar pasar rutas públicas y assets
  if (pathname === '/' || PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Bypass vía variable de entorno en servidor (solo si está configurada) ──
  const bypassCookie = req.cookies.get(BYPASS_COOKIE);
  if (BYPASS_TOKEN && bypassCookie?.value === BYPASS_TOKEN) {
    return NextResponse.next();
  }

  // ── Verificación de IP (red WiFi universidad) ──
  const ip = getClientIp(req);
  if (!isAllowed(ip)) {
    const url = req.nextUrl.clone();
    url.pathname = '/sin-acceso';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.png$|.*\.svg$).*)'],
};

