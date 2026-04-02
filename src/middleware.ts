import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // --- REGRA DE OURO (A SOLUÇÃO) ---
  // Se a rota for da API, libera imediatamente.
  // Isso impede que o middleware tente autenticar rotas de dados e retorne HTML de login.
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 1. Prepara a resposta padrão
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
      // 2. Tenta gerenciar cookies (apenas se tiver o pacote instalado)
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              });
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      await supabase.auth.getUser();
  } catch (e) {
      // Se der erro no Supabase (ex: pacote faltando), apenas segue o jogo
      // para não derrubar o site.
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};