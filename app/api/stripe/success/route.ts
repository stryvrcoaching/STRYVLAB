import Stripe from 'stripe';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
  typescript: true,
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.redirect(new URL('/ipt/pre-analyse?mode=ipt', url.origin));
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Vérification paiement
    const isPaid =
      session.payment_status === 'paid' ||
      (session.status === 'complete' && session.payment_status);

    if (!isPaid) {
      return NextResponse.redirect(new URL('/analyse-ipt', url.origin));
    }

    // Mode depuis metadata (à définir à l’étape 2)
    const mode = (session.metadata?.mode || 'ipt').toLowerCase();
    const safeMode = mode === 'gplus' || mode === 'omni' ? mode : 'ipt';

    // Exemple: récupérer "formula" si tu la mets dans metadata
    const formula = session.metadata?.formula || '';

    const redirectUrl = new URL(`/ipt/pre-analyse?mode=${safeMode}`, url.origin);
    const res = NextResponse.redirect(redirectUrl);

    // Optionnel: stocker la formule en cookie (plus propre que localStorage)
    if (formula) {
      res.cookies.set('stryv_formula', formula, {
        httpOnly: false, // si tu veux le lire côté client
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 jours
      });
    }

    return res;
  } catch (err) {
    console.error('Stripe success redirect error:', err);
    // Fallback sûr
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(new URL('/ipt/pre-analyse?mode=ipt', origin));
  }
}
