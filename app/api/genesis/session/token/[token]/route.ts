import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Récupérer session par token
    const { data: session, error: sessionError } = await supabase
      .from('ipt_sessions')
      .select('*')
      .eq('session_token', token)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or invalid token' },
        { status: 404 }
      );
    }

    // Récupérer user
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', session.user_id)
      .single();

    // Récupérer réponses
    const { data: responses } = await supabase
      .from('ipt_responses')
      .select('*')
      .eq('session_id', session.id)
      .order('question_order', { ascending: true });

    // Formatter réponses
    const responsesObject: Record<string, any> = {};
    if (responses) {
      responses.forEach(r => {
        try {
          responsesObject[r.question_id] = JSON.parse(r.response_value);
        } catch {
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
    console.error('Error fetching session by token:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}