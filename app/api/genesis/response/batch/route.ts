import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { sessionId, responses, currentIndex } = await req.json();

    if (!sessionId || !responses || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: 'sessionId and responses array are required' },
        { status: 400 }
      );
    }

    // Vérifier session
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

    // Préparer les réponses pour insertion
    const responsesToInsert = responses.map(r => ({
      session_id: sessionId,
      user_id: session.user_id,
      question_id: r.questionId,
      question_text: r.questionText,
      question_order: r.questionOrder,
      response_value: String(r.responseValue),
      response_type: r.responseType,
      time_spent_seconds: r.timeSpent || null
    }));

    // Batch UPSERT
    const { error: upsertError } = await supabase
      .from('ipt_responses')
      .upsert(responsesToInsert, {
        onConflict: 'session_id,question_id'
      });

    if (upsertError) throw upsertError;

    // Créer snapshot auto-save
    const responsesSnapshot = Object.fromEntries(
      responses.map(r => [r.questionId, r.responseValue])
    );

    const { error: saveError } = await supabase
      .from('ipt_auto_saves')
      .insert({
        session_id: sessionId,
        responses_snapshot: responsesSnapshot,
        current_index: currentIndex || 0
      });

    // Cleanup: garder seulement 5 derniers snapshots
    const { data: allSaves } = await supabase
      .from('ipt_auto_saves')
      .select('id, saved_at')
      .eq('session_id', sessionId)
      .order('saved_at', { ascending: false });

    if (allSaves && allSaves.length > 5) {
      const idsToDelete = allSaves.slice(5).map(s => s.id);
      await supabase
        .from('ipt_auto_saves')
        .delete()
        .in('id', idsToDelete);
    }

    // Mettre à jour progression
    const totalQuestions = 273;
    const progress = (responses.length / totalQuestions) * 100;

    await supabase
      .from('ipt_sessions')
      .update({
        current_question_index: currentIndex || 0,
        progress_percentage: progress,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      saved: responses.length,
      progress: progress.toFixed(2)
    });

  } catch (error: any) {
    console.error('Error batch saving:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}