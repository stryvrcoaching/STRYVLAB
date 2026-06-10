import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const sessionId = searchParams.get('session_id');
  const productType = searchParams.get('product');

  if (!code) {
    return NextResponse.redirect(
      new URL('/error?code=no_auth_code', req.url)
    );
  }

  try {
    // Échanger code pour session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) throw error;

    const authUserId = data.user.id;
    const email = data.user.email!;

    console.log('✅ Utilisateur authentifié:', { authUserId, email });

    // Lier session IPT au compte auth
    if (sessionId) {
      const { data: linkResult } = await supabase.rpc('link_ipt_session_to_auth', {
        p_email: email,
        p_auth_user_id: authUserId,
        p_session_id: sessionId,
      });

      console.log('🔗 Session IPT liée:', linkResult);
    }

    // Récupérer résultat IPT si existe
    let iptResultId = null;
    if (sessionId) {
      const { data: result } = await supabase
        .from('ipt_results')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      iptResultId = result?.id;
    }

    // Activer accès dashboard
    if (productType && iptResultId) {
      await supabase.rpc('activate_dashboard_access', {
        p_auth_user_id: authUserId,
        p_product_type: `${productType}_report`,
        p_ipt_result_id: iptResultId,
      });

      console.log('🔓 Accès dashboard activé');
    }

    // Enregistrer purchase
    if (sessionId) {
      const { data: session } = await supabase
        .from('ipt_sessions')
        .select('payment_intent_id, payment_amount, payment_currency')
        .eq('id', sessionId)
        .single();

      if (session?.payment_intent_id) {
        await supabase.from('user_purchases').insert({
          auth_user_id: authUserId,
          stripe_payment_intent_id: session.payment_intent_id,
          product_type: `${productType}_protocol`,
          status: 'succeeded',
          amount: session.payment_amount,
          currency: session.payment_currency,
          ipt_session_id: sessionId,
        });

        console.log('💳 Purchase enregistré');
      }
    }

    // Vérifier si onboarding complété
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('id', authUserId)
      .single();

    // Rediriger vers dashboard
    return NextResponse.redirect(
      new URL('/dashboard', req.url)
    );

  } catch (error: any) {
    console.error('❌ Erreur callback auth:', error);
    return NextResponse.redirect(
      new URL('/error?code=auth_failed', req.url)
    );
  }
}