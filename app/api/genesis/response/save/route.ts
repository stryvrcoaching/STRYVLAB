import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      sessionId,
      questionId,
      questionText,
      questionOrder,
      responseValue,
      responseType,
      timeSpent
    } = await req.json();

    if (!sessionId || !questionId) {
      return NextResponse.json(
        { error: 'sessionId and questionId are required' },
        { status: 400 }
      );
    }

    // Vérifier que la session existe
    const { data: session, error: sessionError } = await supabase
      .from('ipt_sessions')
      .select('id, user_id, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Session already completed' },
        { status: 400 }
      );
    }

    // Sauvegarder la réponse (UPSERT)
    const { data: response, error: responseError } = await supabase
      .from('ipt_responses')
      .upsert({
        session_id: sessionId,
        user_id: session.user_id,
        question_id: questionId,
        question_text: questionText,
        question_order: questionOrder,
        response_value: String(responseValue),
        response_type: responseType,
        time_spent_seconds: timeSpent || null
      }, {
        onConflict: 'session_id,question_id'
      })
      .select()
      .single();

    if (responseError) throw responseError;

    // Mettre à jour progression
    const { data: responsesCount } = await supabase
      .from('ipt_responses')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    const totalQuestions = 273;
    const progress = ((responsesCount?.length || 0) / totalQuestions) * 100;

    await supabase
      .from('ipt_sessions')
      .update({
        current_question_index: questionOrder,
        progress_percentage: progress,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      responseId: response.id,
      progress: progress.toFixed(2)
    });

  } catch (error: any) {
    console.error('Error saving response:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}