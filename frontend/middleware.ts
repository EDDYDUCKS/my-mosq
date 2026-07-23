import { NextRequest, NextResponse } from 'next/server';

// ── IPs/rangos permitidos ──────────────────────────────────────────────────
const RAW = process.env.ALLOWED_IPS ?? '208.96.129.55';
const ALLOWED = RAW.split(',').map(s => s.trim()).filter(Boolean);

// ── Cookie de bypass (puerta secreta) ─────────────────────────────────────
const BYPASS_COOKIE = 'mosq_bypass';
const BYPASS_TOKEN  = 'ulsa-dev-2025';

// Rutas que NO necesitan verificación
const PUBLIC_PATHS = ['/sin-acceso', '/login', '/_next', '/favicon', '/ESTRELLASALLE', '/manifest.json'];

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

function isAllowed(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.')) return true;
  if (ALLOWED.includes('*')) return true;
  return ALLOWED.some(allowed =>
    allowed.endsWith('.') ? ip.startsWith(allowed) : ip === allowed
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Dejar pasar rutas públicas y assets
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Puerta secreta: si la cookie de bypass es válida, acceso libre ──
  const bypassCookie = req.cookies.get(BYPASS_COOKIE);
  if (bypassCookie?.value === BYPASS_TOKEN) {
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

