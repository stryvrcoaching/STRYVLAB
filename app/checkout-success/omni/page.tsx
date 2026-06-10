'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown } from 'lucide-react';
import CalOmniWidget from '@/components/booking/CalOmniWidget';

export default function OmniSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // 🔐 autorisation omni (24h)
    document.cookie = 'stryv_access=omni; path=/; max-age=86400';
  }, []);

  return (
    <main className="min-h-screen bg-background px-6 py-16">

      <div className="max-w-4xl mx-auto space-y-12">

        {/* =====================================================
            CONFIRMATION — Épurée
        ===================================================== */}
        <div className="text-center space-y-6">
          
          {/* Icône succès */}
          <div className="w-16 h-16 mx-auto rounded-full bg-surface shadow-soft-out flex items-center justify-center">
            <Check className="w-8 h-8 text-accent" strokeWidth={3} />
          </div>

          {/* Titre */}
          <div>
            <h1 className="text-3xl font-bold text-primary mb-3">
              Admission confirmée
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-surface rounded-full shadow-soft-out">
              <Crown size={14} className="text-accent" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Accès OMNI™</span>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-secondary leading-relaxed max-w-xl mx-auto">
            Votre admission au système <strong className="text-primary">OMNI™</strong> est validée. 
            Réservez votre session stratégique pour déclencher l'analyse IPT™.
          </p>
        </div>

        {/* =====================================================
            CALENDRIER CAL.COM
        ===================================================== */}
        <div className="bg-surface rounded-card shadow-soft-out overflow-hidden">
          
          {/* Header calendrier */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-bold text-primary mb-1">
              Kick-off Stratégique
            </h2>
            <p className="text-xs text-secondary">
              Cadrage priorités + déclenchement pré-analyse IPT™
            </p>
          </div>

          {/* Widget Cal.com */}
          <div className="bg-white">
            <CalOmniWidget
              onBooked={() => router.push('/ipt/pre-analyse?mode=omni')}
            />
          </div>

        </div>

        {/* =====================================================
            RÉASSURANCE — Minimaliste
        ===================================================== */}
        <div className="text-center space-y-3">
          <p className="text-xs text-accent font-medium">
            Redirection automatique après réservation
          </p>
          <p className="text-xs text-secondary">
            L'accès OMNI™ inclut l'ingénierie complète IPT™
          </p>
        </div>

      </div>
    </main>
  );
}