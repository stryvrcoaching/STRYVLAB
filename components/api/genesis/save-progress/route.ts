import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, currentModule, currentQuestionIndex, responses } = body;

    // Upsert submission (create or update)
    const { data, error } = await supabase
      .from('ipt_submissions')
      .upsert({
        session_id: sessionId,
        current_step: currentModule + 1,
        total_steps: 9,
        responses: responses,
        last_updated_at: new Date().toISOString(),
        is_completed: false,
      }, {
        onConflict: 'session_id'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, submissionId: data.id });
  } catch (error) {
    console.error('Save progress error:', error);
    return NextResponse.json(
      { error: 'Failed to save progress' },
      { status: 500 }
    );
  }
}