import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Vérifier session
    const { data: session, error: sessionError } = await supabase
      .from('ipt_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Vérifier que 273 réponses sont complètes
    const { count } = await supabase
      .from('ipt_responses')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (count !== 273) {
      return NextResponse.json(
        { 
          error: 'Session incomplete',
          responsesCount: count,
          required: 273
        },
        { status: 400 }
      );
    }

    // Marquer comme complétée
    const { error: updateError } = await supabase
      .from('ipt_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress_percentage: 100,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'Session completed successfully'
    });

  } catch (error: any) {
    console.error('Error completing session:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}