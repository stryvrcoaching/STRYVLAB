import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { randomBytes } from 'crypto';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, deviceInfo, ipAddress } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // 1. Créer ou récupérer user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({ email })
        .select('id')
        .single();

      if (userError) throw userError;
      userId = newUser.id;
    }

    // 2. Générer token unique
    const sessionToken = randomBytes(32).toString('hex');

    // 3. Créer session
    const { data: session, error: sessionError } = await supabase
      .from('ipt_sessions')
      .insert({
        user_id: userId,
        email: email,
        session_token: sessionToken,
        device_info: deviceInfo || {},
        ip_address: ipAddress || null,
        status: 'in_progress',
        total_questions: 273,
        current_question_index: 0,
        progress_percentage: 0
      })
      .select('id, session_token, user_id, email')
      .single();

    if (sessionError) throw sessionError;

    console.log('Session created:', session);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionToken: session.session_token,
      userId: session.user_id,
      email: session.email
    });

  } catch (error: any) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}