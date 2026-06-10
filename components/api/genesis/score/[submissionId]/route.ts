import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  try {
    const { submissionId } = params;

    const { data: submission, error: submissionError } = await supabase
      .from('ipt_submissions')
      .select('*, ipt_scores(*)')
      .eq('id', submissionId)
      .single();

    if (submissionError) throw submissionError;

    if (!submission.ipt_scores || submission.ipt_scores.length === 0) {
      return NextResponse.json(
        { error: 'Score not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      submission,
      score: submission.ipt_scores[0],
    });
  } catch (error) {
    console.error('Get score error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve score' },
      { status: 500 }
    );
  }
}