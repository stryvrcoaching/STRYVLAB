import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 });

    stripe.webhooks.constructEvent(body, signature, webhookSecret);

    return NextResponse.json(
      { received: true, retired: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
}
