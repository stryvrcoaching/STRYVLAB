import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Correction : Utilisation de la version API attendue par ton package installé
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20', 
  typescript: true,
});

export async function POST(request: Request) {
  try {
    const { amount } = await request.json();

    // Création du PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // En centimes
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Stripe Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}