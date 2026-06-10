import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialisation Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
  typescript: true,
});

export async function POST() {
  try {
    // Base URL (dev / prod)
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Création de la session Stripe Checkout — ANALYSE IPT
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],

      // 👇 C'est cette ligne qui active le champ dans la fenêtre
      allow_promotion_codes: true,

      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Analyse IPT — Rapport de Potentiel de Transformation',
              description:
                'Analyse structurée visant à calculer l’indice de potentiel de transformation (IPT™).\n\n' +
                'Le paiement donne accès :\n' +
                '– à une analyse IPT (collecte et modélisation des données)\n' +
                '– au calcul d’un score IPT™ (0–100)\n' +
                '– à un rapport de potentiel de transformation détaillant freins, leviers et priorités\n\n' +
                'Ce service ne constitue ni un programme d’entraînement, ni une promesse de résultat.',
            },
            unit_amount: 3500, // 35,00 €
          },
          quantity: 1,
        },
      ],

      mode: 'payment',

      // ✅ MÉTADONNÉES CANONIQUES IPT
      metadata: {
        product_type: 'analysis',
        formula: 'ipt',
        includes_ipt: 'true',
        ipt_required: 'true',
        access_type: 'automatic',
        version: 'v1',
      },
      

      success_url: `${baseUrl}/checkout-success/ipt?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${baseUrl}/analyse-ipt`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Erreur Stripe:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la session Stripe' },
      { status: 500 }
    );
  }
}