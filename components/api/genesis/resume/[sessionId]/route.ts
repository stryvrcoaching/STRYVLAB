import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    const { data, error } = await supabase
      .from('ipt_submissions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_completed', false)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: data.session_id,
      currentModule: data.current_step - 1,
      responses: data.responses,
    });
  } catch (error) {
    console.error('Resume session error:', error);
    return NextResponse.json(
      { error: 'Failed to resume session' },
      { status: 500 }
    );
  }
}