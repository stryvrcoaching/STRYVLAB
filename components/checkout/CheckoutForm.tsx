'use client';

import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Lock, Loader2, AlertTriangle } from 'lucide-react';

export default function CheckoutForm({ amount }: { amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Redirection après paiement réussi (page de remerciement)
        return_url: `${window.location.origin}/checkout/success`,
      },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message || "Une erreur est survenue.");
    } else {
      setMessage("Une erreur inattendue est survenue.");
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Le composant Stripe officiel qui s'intègre dans ton design */}
      <div className="bg-surface-light p-4 rounded-xl border border-gray-100">
        <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      </div>

      {/* Affichage des erreurs style Lab */}
      {message && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-xs font-medium">
          <AlertTriangle size={16} />
          {message}
        </div>
      )}

      {/* Bouton d'action */}
      <button
        disabled={isLoading || !stripe || !elements}
        id="submit"
        className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="animate-spin w-4 h-4" />
        ) : (
          <>
            <Lock className="w-4 h-4" /> Payer {amount}€
          </>
        )}
      </button>
      
      <p className="text-center text-[10px] text-gray-400 flex items-center justify-center gap-1">
        <Lock size={10} /> Paiement sécurisé SSL chiffré 256-bit
      </p>
    </form>
  );
}