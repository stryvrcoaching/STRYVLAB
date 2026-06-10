import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    // Récupérer session
    const { data: session, error: sessionError } = await supabase
      .from('ipt_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Récupérer user
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', session.user_id)
      .single();

    // Récupérer toutes les réponses
    const { data: responses, error: responsesError } = await supabase
      .from('ipt_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true });

    if (responsesError) throw responsesError;

    // Formatter réponses en objet clé-valeur
    const responsesObject: Record<string, any> = {};
    if (responses) {
      responses.forEach(r => {
        try {
          // Tenter de parser si c'est du JSON
          responsesObject[r.question_id] = JSON.parse(r.response_value);
        } catch {
          // Sinon garder tel quel
          responsesObject[r.question_id] = r.response_value;
        }
      });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        email: session.email,
        status: session.status,
        progress: session.progress_percentage,
        currentIndex: session.current_question_index,
        startedAt: session.started_at,
        lastActivity: session.last_activity_at
      },
      user: user || null,
      responses: responsesObject,
      responsesCount: responses?.length || 0
    });

  } catch (error: any) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}