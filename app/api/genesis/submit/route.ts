import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { computeIPTScore } from '@/app/lib/genesis/scoring/scoring-engine';
import rawMapping from '@/app/lib/genesis/mapping/questions_to_axes.json';
import type { MappingFile } from '@/app/lib/genesis/scoring/scoring-engine';

const mapping = rawMapping as unknown as MappingFile;


const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, responses, email } = body;

    // 1. Marquer la soumission comme complétée
    const { data: submission, error: submissionError } = await supabase
      .from('ipt_submissions')
      .update({
        responses,
        email,
        is_completed: true,
        completed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .select()
      .single();

    if (submissionError || !submission) {
      throw submissionError ?? new Error('Submission not found');
    }

    // 2. Calcul du score IPT
    const scoreResult = computeIPTScore(responses, mapping);

    // 3. Sauvegarde du score réel
    const { data: score, error: scoreError } = await supabase
      .from('ipt_scores')
      .insert({
        submission_id: submission.id,
        scoring_version: scoreResult.scoring_version,
        ipt_global: scoreResult.ipt_global,
        axes: scoreResult.axes, // JSONB recommandé
      })
      .select()
      .single();

    if (scoreError) throw scoreError;

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      scoreId: score.id,
      iptGlobal: scoreResult.ipt_global,
    });

  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json(
      { error: 'Failed to submit questionnaire' },
      { status: 500 }
    );
  }
}
