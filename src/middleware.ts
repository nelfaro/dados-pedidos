import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, verificarToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const publico = pathname === '/login' || pathname === '/api/login';
  const sesion = await verificarToken(req.cookies.get(COOKIE)?.value);

  if (publico) {
    if (sesion && pathname === '/login') return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }
  if (!sesion) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }
  // La verificacion real del rol (contra la base) la hace cada API; esto solo evita mostrar la pantalla.
  if (pathname.startsWith('/usuarios') && sesion.rol !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
