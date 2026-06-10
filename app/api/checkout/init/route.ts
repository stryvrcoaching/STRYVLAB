import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialisation Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
});

// 1. CONFIGURATION PRODUITS (Source de vérité)
const PRODUCTS = {
  'ipt': { price: 3500, name: 'Analyse IPT™' },
  'gplus': { price: 25000, name: 'Protocole G+' }, // <--- LE VOILÀ
  'omni': { price: 80000, name: 'OMNI (Coaching 12 Semaines)' }
};

// 2. DÉFINITION DES RÈGLES PROMO
type PromoRule = {
  percent: number;
  type: 'VIP' | 'RETURNING' | 'AMBASSADOR' | 'WELCOME' | 'INFLUENCER';
  usageLimit: 'UNLIMITED' | 'ONCE_PER_USER';
  description: string;
};

const PROMO_RULES: Record<string, PromoRule> = {
  "KEV100": { percent: 100, type: 'VIP', usageLimit: 'UNLIMITED', description: "Accès VIP Intégral" },
  "COMEBACK35": { percent: 35, type: 'RETURNING', usageLimit: 'ONCE_PER_USER', description: "Offre de retour client" },
  "AMBASSADOR20": { percent: 20, type: 'AMBASSADOR', usageLimit: 'UNLIMITED', description: "Privilège Ambassadeur" },
  "WELCOME15": { percent: 15, type: 'WELCOME', usageLimit: 'ONCE_PER_USER', description: "Offre de bienvenue" },
  "KEVX10": { percent: 10, type: 'INFLUENCER', usageLimit: 'UNLIMITED', description: "Code Partenaire" },
  "MAT6PACK": { percent: 10, type: 'INFLUENCER', usageLimit: 'UNLIMITED', description: "Code Partenaire" },
  "GENESIS10": { percent: 10, type: 'INFLUENCER', usageLimit: 'UNLIMITED', description: "Code Standard" }
};

export async function POST(request: Request) {
  try {
    const { productId, promoCode, userEmail } = await request.json();
    
    // ---------------------------------------------------------
    // ÉTAPE 1 : VALIDATION DU PRODUIT
    // ---------------------------------------------------------
    // CORRECTION TYPE SCRIPT ICI 👇
    // On force le type pour dire que productId est bien une clé de PRODUCTS
    const product = PRODUCTS[productId as keyof typeof PRODUCTS];
    
    if (!product) {
      return NextResponse.json({ error: "Produit invalide ou non reconnu." }, { status: 400 });
    }

    let finalAmount = product.price;
    let discountApplied = null;

    // ---------------------------------------------------------
    // ÉTAPE 2 : CALCUL DE LA RÉDUCTION
    // ---------------------------------------------------------
    if (promoCode) {
      const code = String(promoCode).toUpperCase().trim();
      const rule = PROMO_RULES[code];
      
      if (rule) {
        // --- CALCUL ---
        const discountAmount = Math.round((product.price * rule.percent) / 100);
        finalAmount = Math.max(0, product.price - discountAmount);
        
        discountApplied = {
          code,
          percent: rule.percent,
          amountSaved: discountAmount,
          type: rule.type
        };
      }
    }

    // ---------------------------------------------------------
    // ÉTAPE 3 : BRANCHEMENT (GRATUIT vs PAYANT)
    // ---------------------------------------------------------

    // CAS A : 100% GRATUIT
    if (finalAmount === 0) {
      return NextResponse.json({
        amount: 0,
        currency: 'eur',
        isFree: true,
        discount: discountApplied,
        clientSecret: null
      });
    }

    // CAS B : PAYANT (Stripe)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        product_id: productId,
        product_name: product.name,
        promo_code: discountApplied?.code || 'NONE',
        base_price: product.price,
        legal_toc_version: "V1_2024_STANDARD", 
        legal_withdrawal_waived: "true"
      }
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: finalAmount,
      isFree: false,
      discount: discountApplied
    });

  } catch (error: any) {
    console.error("[STRIPE INIT ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Erreur technique." }, 
      { status: 500 }
    );
  }
}