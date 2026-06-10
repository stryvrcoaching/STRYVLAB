import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
  typescript: true,
});

export async function POST(req: Request) {
  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id manquant' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    return NextResponse.json({
      success: true,
      formula: session.metadata?.formula || null,
      product_type: session.metadata?.product_type || null,
      metadata: session.metadata || {},
    });
  } catch (error) {
    console.error('Erreur récupération session Stripe:', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer la session Stripe' },
      { status: 500 }
    );
  }
}

