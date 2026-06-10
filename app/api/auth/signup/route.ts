import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName,
      sessionId,
      productType 
    } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Créer compte Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmer l'email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authError) throw authError;

    const authUserId = authData.user.id;

    // Créer profil
    await supabase.from('user_profiles').insert({
      id: authUserId,
      first_name: firstName,
      last_name: lastName,
    });

    // Lier session IPT si existe
    if (sessionId && email) {
      await supabase.rpc('link_ipt_session_to_auth', {
        p_email: email,
        p_auth_user_id: authUserId,
        p_session_id: sessionId,
      });
    }

    // Activer accès dashboard si produit acheté
    if (productType && sessionId) {
      // Récupérer résultat IPT
      const { data: result } = await supabase
        .from('ipt_results')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      if (result) {
        await supabase.rpc('activate_dashboard_access', {
          p_auth_user_id: authUserId,
          p_product_type: `${productType}_report`,
          p_ipt_result_id: result.id,
        });
      }
    }

    console.log('✅ Compte créé:', { authUserId, email });

    return NextResponse.json({
      success: true,
      message: 'Compte créé avec succès',
      userId: authUserId,
    });

  } catch (error: any) {
    console.error('❌ Erreur signup:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}