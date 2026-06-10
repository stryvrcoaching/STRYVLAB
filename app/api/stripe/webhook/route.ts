import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // PAIEMENT RÉUSSI
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      const {
        email,
        session_id: sessionId,
        product_type: productType,
      } = paymentIntent.metadata;

      console.log('💰 Paiement réussi:', {
        email,
        sessionId,
        productType,
        amount: paymentIntent.amount,
      });

      // Marquer session comme payée
      if (sessionId) {
        await supabase
          .from('ipt_sessions')
          .update({
            paid: true,
            payment_intent_id: paymentIntent.id,
            payment_amount: paymentIntent.amount,
            payment_currency: paymentIntent.currency,
          })
          .eq('id', sessionId);
      }

      // Générer magic link Supabase Auth
      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?session_id=${sessionId}&product=${productType}`,
        },
      });

      if (error) {
        console.error('❌ Erreur génération magic link:', error);
        throw error;
      }

      // Envoyer email via Resend
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Créez votre compte STRYV lab',
        html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 16px;">
  <div style="max-width: 520px; margin: 0 auto;">
    <div style="background: #1A1A1A; border-radius: 16px 16px 0 0; padding: 28px 40px; text-align: center;">
      <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">STRYV lab</span>
    </div>
    <div style="background: #ffffff; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.07);">
      <h2 style="margin: 0 0 16px; color: #1A1A1A; font-size: 20px;">Paiement confirmé !</h2>
      <p style="color: #555; margin: 0 0 12px;">Bonjour,</p>
      <p style="color: #555; margin: 0 0 20px;">Votre paiement pour <strong style="color: #1A1A1A;">${getProductName(productType)}</strong> a été validé.</p>
      <p style="color: #555; margin: 0 0 24px;">Créez votre compte STRYV lab pour accéder à votre dashboard :</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${data.properties.action_link}"
           style="display: inline-block; background: #0e8c5b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
          Créer mon compte
        </a>
      </div>
      <p style="font-size: 12px; color: #999; margin: 0;">Ce lien est valide pendant 24h.</p>
    </div>
    <p style="text-align: center; font-size: 12px; color: #aaa; margin-top: 24px;">STRYV lab — IPT™ · Questions ? Répondez à cet email.</p>
  </div>
</body>
</html>`,
      });

      console.log('📧 Email création compte envoyé à:', email);

      return NextResponse.json({ 
        received: true,
        action: 'account_creation_email_sent'
      });

    } catch (error) {
      console.error('❌ Erreur traitement paiement:', error);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

function getProductName(type: string): string {
  const names: Record<string, string> = {
    ipt: 'Rapport IPT™',
    gplus: 'Système G+ (6 semaines)',
    omni: 'OMNI Hybrid (12 semaines)',
  };
  return names[type] || type;
}