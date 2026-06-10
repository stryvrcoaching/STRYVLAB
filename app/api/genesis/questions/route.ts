// app/api/genesis/questions/route.ts

import { NextResponse } from 'next/server';
import { loadAllQuestions } from '../../../lib/genesis/questions/csv-parser';

// Cache les questions en mémoire
let cachedQuestions: any[] | null = null;

export async function GET() {
  try {
    // Load questions (from cache if available)
    if (!cachedQuestions) {
      cachedQuestions = loadAllQuestions();
    }

    return NextResponse.json({
      success: true,
      questions: cachedQuestions,
      total: cachedQuestions.length,
    });
  } catch (error) {
    console.error('Error loading questions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to load questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: Force reload
export async function POST() {
  try {
    cachedQuestions = null;
    cachedQuestions = loadAllQuestions();
    
    return NextResponse.json({
      success: true,
      message: 'Questions reloaded',
      total: cachedQuestions.length,
    });
  } catch (error) {
    console.error('Error reloading questions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reload questions' },
      { status: 500 }
    );
  }
}