'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/checkout/CheckoutForm';
import { ShieldCheck, FileText, BarChart2, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Initialisation Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function IPTCheckoutPage() {
  const [clientSecret, setClientSecret] = useState("");
  const AMOUNT = 35; // Prix du rapport IPT

  useEffect(() => {
    // Création de l'intention de paiement
    fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: AMOUNT * 100 }), // Conversion en centimes
    })
      .then((res) => res.json())
      .then((data) => setClientSecret(data.clientSecret));
  }, []);

  // Configuration Design System (Strictement identique aux autres pages)
  const appearance = {
    theme: 'flat' as const,
    variables: {
      colorPrimary: '#0F172A',
      colorBackground: '#ffffff',
      colorText: '#0F172A',
      colorDanger: '#ef4444',
      fontFamily: '"Outfit", system-ui, sans-serif',
      fontSizeBase: '14px',
      borderRadius: '12px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': { border: '1px solid #E2E8F0', boxShadow: 'none' },
      '.Input:focus': { border: '1px solid #0F172A', boxShadow: 'none' },
      '.Label': { fontWeight: '500', color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }
    }
  };

  const options = {
    clientSecret,
    appearance,
  };

  return (
    <main className="min-h-screen bg-background text-primary font-outfit py-12 px-4 flex items-center justify-center">
      
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-start relative z-10">
        
        {/* COLONNE GAUCHE : DÉTAIL DU PRODUIT */}
        <div className="space-y-8">
            
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-secondary hover:text-primary transition-colors uppercase tracking-widest mb-4">
                <ArrowLeft size={12} /> Retour
            </Link>

            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-bold tracking-widest text-accent uppercase mb-4">
                    <BarChart2 size={12} />
                    Rapport Diagnostic
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2 tracking-tight">
                    Analyse IPT™ Complète
                </h1>
                <p className="text-secondary text-sm leading-relaxed">
                    Débloquez l'intégralité de vos résultats métaboliques et identifiez précisément vos leviers de progression.
                </p>
            </div>

            {/* CARTE RÉCAPITULATIVE */}
            <div className="bg-surface border border-white/60 p-6 rounded-2xl shadow-soft-out space-y-6">
                
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-surface-light rounded-lg text-primary"><BarChart2 size={18} /></div>
                        <div>
                            <h3 className="text-sm font-bold text-primary">Score Global & Détails</h3>
                            <p className="text-xs text-secondary mt-1">Accès aux scores pondérés sur les 6 axes physiologiques.</p>
                        </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-surface-light rounded-lg text-primary"><FileText size={18} /></div>
                        <div>
                            <h3 className="text-sm font-bold text-primary">Détection des Blocages</h3>
                            <p className="text-xs text-secondary mt-1">Identification des patterns limitants (Stress, Sommeil, Métabolisme).</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-surface-light rounded-lg text-primary"><CheckCircle2 size={18} /></div>
                        <div>
                            <h3 className="text-sm font-bold text-primary">Plan d'Action Prioritaire</h3>
                            <p className="text-xs text-secondary mt-1">Les 3 actions correctives immédiates basées sur votre profil.</p>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-lg font-bold text-primary">Total à régler</span>
                    <span className="text-3xl font-bold text-primary tracking-tight">{AMOUNT},00€</span>
                </div>
            </div>

            <div className="flex gap-3 text-xs text-secondary/80 bg-surface-light p-4 rounded-xl border border-gray-100">
                <ShieldCheck className="text-emerald-600 w-4 h-4 flex-shrink-0" />
                <span>Paiement unique sécurisé. Accès immédiat au rapport PDF et Digital.</span>
            </div>
        </div>

        {/* COLONNE DROITE : PAIEMENT SÉCURISÉ */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
            {/* Gradient Top Border */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20"></div>
            
            <div className="mb-8 flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                    Paiement par Carte
                </h2>
                <div className="flex gap-2 opacity-50 grayscale hover:grayscale-0 transition-all">
                    {/* Placeholder icônes cartes - Optionnel */}
                    <div className="h-6 w-10 bg-gray-100 rounded border border-gray-200"></div>
                    <div className="h-6 w-10 bg-gray-100 rounded border border-gray-200"></div>
                </div>
            </div>

            {clientSecret ? (
                <Elements options={options} stripe={stripePromise}>
                    <CheckoutForm amount={AMOUNT} />
                </Elements>
            ) : (
                // Squelette de chargement
                <div className="space-y-5 animate-pulse">
                    <div className="space-y-2">
                        <div className="h-3 w-1/4 bg-gray-100 rounded"></div>
                        <div className="h-10 bg-gray-100 rounded-xl border border-gray-200"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-10 bg-gray-100 rounded-xl border border-gray-200"></div>
                        <div className="h-10 bg-gray-100 rounded-xl border border-gray-200"></div>
                    </div>
                    <div className="h-12 bg-gray-100 rounded-xl mt-6"></div>
                </div>
            )}
        </div>

      </div>
    </main>
  );
}