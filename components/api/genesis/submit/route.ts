import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateIPTScore } from '@/app/lib/genesis/scoring-engine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, responses, email } = body;

    // 1. Mettre à jour submission comme complétée
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

    if (submissionError) throw submissionError;

    // 2. Calculer score IPT
    const scoreData = calculateIPTScore(responses);

    // 3. Sauvegarder score
    const { data: score, error: scoreError } = await supabase
      .from('ipt_scores')
      .insert({
        submission_id: submission.id,
        ipt_score: scoreData.iptScore,
        ipt_category: scoreData.iptCategory,
        metabolic_score: scoreData.metabolicScore,
        infrastructure_score: scoreData.infrastructureScore,
        psychology_score: scoreData.psychologyScore,
        physiology_score: scoreData.physiologyScore,
        adherence_score: scoreData.adherenceScore,
        detected_patterns: scoreData.detectedPatterns,
        red_flags: scoreData.redFlags,
        root_causes: scoreData.rootCauses,
        recommendations: scoreData.recommendations,
        detailed_scores: scoreData.detailedScores,
      })
      .select()
      .single();

    if (scoreError) throw scoreError;

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      scoreId: score.id,
      iptScore: score.ipt_score,
      iptCategory: score.ipt_category,
    });
  } catch (error) {
    console.error('Submit error:', error);
    return NextResponse.json(
      { error: 'Failed to submit questionnaire' },
      { status: 500 }
    );
  }
}