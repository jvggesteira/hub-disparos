import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Verify caller is admin
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Parse body
    const supabaseAdmin = getSupabaseAdmin();
    const { email, clientId, clientName } = await request.json();

    if (!email || !clientId) {
      return NextResponse.json({ error: 'Email e clientId são obrigatórios' }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // User already exists - just link profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: existingUser.id,
          email,
          name: clientName || email.split('@')[0],
          role: 'client',
          client_id: clientId,
        }, { onConflict: 'id' });

      if (profileError) {
        return NextResponse.json({ error: `Erro ao vincular perfil: ${profileError.message}` }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Usuário já existe. Perfil vinculado como cliente.',
        alreadyExists: true,
      });
    }

    // Invite new user
    const redirectUrl = `${request.nextUrl.origin}/auth/callback?next=/update-password`;

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        client_id: clientId,
        client_name: clientName,
        role: 'client',
      },
      redirectTo: redirectUrl,
    });

    if (inviteError) {
      return NextResponse.json({ error: `Erro ao enviar convite: ${inviteError.message}` }, { status: 500 });
    }

    // Pre-create profile so it's ready when they accept
    if (inviteData.user) {
      await supabaseAdmin.from('profiles').upsert({
        id: inviteData.user.id,
        email,
        name: clientName || email.split('@')[0],
        role: 'client',
        client_id: clientId,
      }, { onConflict: 'id' });
    }

    return NextResponse.json({
      success: true,
      message: `Convite enviado para ${email}`,
      userId: inviteData.user?.id,
    });
  } catch (err: any) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
