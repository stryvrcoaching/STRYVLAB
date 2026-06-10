import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Liste blanche des codes donnant accès à 100% de réduction
// À sécuriser ou déplacer en variable d'environnement si besoin
const FREE_ACCESS_CODES = ["KEV100"]; 

export async function POST(request: Request) {
  try {
    // 1. Récupération et parsing des données envoyées par le client
    const body = await request.json();
    const { promoCode, productId, legalAccepted } = body;

    // 2. Sécurité : Validation du Code Promo
    // On nettoie l'entrée (trim + uppercase) pour éviter les erreurs de frappe
    const normalizedCode = promoCode ? String(promoCode).toUpperCase().trim() : "";
    
    if (!FREE_ACCESS_CODES.includes(normalizedCode)) {
      return NextResponse.json(
        { error: "Code non autorisé pour l'accès gratuit." }, 
        { status: 403 }
      );
    }

    // 3. Sécurité : Validation du Consentement Légal (Conformité UE)
    // Le serveur refuse la transaction si le client n'a pas explicitement accepté
    if (legalAccepted !== true) {
      return NextResponse.json(
        { error: "Le consentement aux conditions légales est requis." }, 
        { status: 400 }
      );
    }

    // 4. Génération d'un Token de Session Sécurisé
    // crypto.randomUUID() génère un identifiant unique universel (v4) impossible à deviner
    const secureSessionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // 5. ENREGISTREMENT COMMANDE (Point d'intégration Base de Données)
    // ------------------------------------------------------------------
    // C'est ici que tu devras connecter ta DB (Supabase, Prisma, Firebase, etc.)
    // Pour l'instant, on simule un log serveur structuré.
    
    const orderRecord = {
      order_id: secureSessionId,
      type: 'FREE_ACCESS_GRANT',
      product_id: productId || 'ipt',
      promo_code: normalizedCode,
      amount_paid: 0,
      currency: 'EUR',
      status: 'COMPLETED',
      legal_proof: {
        terms_accepted: true,
        withdrawal_waived: true,
        timestamp: timestamp,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown'
      },
      created_at: timestamp
    };

    // TODO: await db.orders.create({ data: orderRecord });
    console.log("[AUDIT] Free Order Created:", JSON.stringify(orderRecord, null, 2));
    // ------------------------------------------------------------------

    // 6. Réponse Succès au Client
    // On renvoie l'URL de redirection avec le token sécurisé
    return NextResponse.json({ 
      success: true, 
      redirectUrl: `/checkout/success?session_id=${secureSessionId}&type=free` 
    });

  } catch (error) {
    console.error("[CRITICAL] Error in secure-free route:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur lors de la validation." }, 
      { status: 500 }
    );
  }
}