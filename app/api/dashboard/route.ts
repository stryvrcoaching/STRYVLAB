import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase server environment variables are missing.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    // Vérifier authentification
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Session invalide' },
        { status: 401 }
      );
    }

    const authUserId = user.id;
    const email = user.email!;

    // Récupérer profil coach
    const { data: profile } = await supabase
      .from('coach_profiles')
      .select('full_name')
      .eq('coach_id', authUserId)
      .maybeSingle();

    // Récupérer accès dashboard
    const { data: access } = await supabase
      .from('dashboard_access')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    // Récupérer sessions IPT
    const { data: sessions } = await supabase
      .from('ipt_sessions')
      .select('id, status')
      .eq('email', email);

    const totalSessions = sessions?.length || 0;
    const completedSessions = sessions?.filter(s => s.status === 'completed').length || 0;

    // Récupérer dernier résultat IPT
    const { data: latestResult } = await supabase
      .from('ipt_results')
      .select(`
        id,
        ipt_global,
        generated_at,
        session_id
      `)
      .in('session_id', sessions?.map(s => s.id) || [])
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    // Récupérer purchases
    const { data: purchases } = await supabase
      .from('user_purchases')
      .select('*')
      .eq('auth_user_id', authUserId)
      .order('purchased_at', { ascending: false });

    // Récupérer subscriptions
    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('auth_user_id', authUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    // Construire réponse
    const dashboardData = {
      user: {
        email,
        firstName: profile?.full_name?.trim().split(/\s+/)[0] || null,
        lastName: profile?.full_name?.trim().split(/\s+/).slice(1).join(' ') || null,
      },
      access: {
        hasIptReport: access?.has_ipt_report || false,
        hasGplusProtocol: access?.has_gplus_protocol || false,
        hasOmniProtocol: access?.has_omni_protocol || false,
        canAccessTools: access?.can_access_tools !== false,
      },
      latestIpt: latestResult ? {
        score: latestResult.ipt_global,
        generatedAt: latestResult.generated_at,
        resultId: latestResult.id,
      } : null,
      sessions: {
        total: totalSessions,
        completed: completedSessions,
      },
      purchases: purchases || [],
      subscriptions: subscriptions || [],
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });

  } catch (error: any) {
    console.error('❌ Erreur dashboard:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
