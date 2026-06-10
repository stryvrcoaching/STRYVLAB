'use client';

import { useEffect } from 'react';

interface CalendlyButtonProps {
  text: string;
  className?: string;
}

declare global {
  interface Window {
    Calendly?: any;
  }
}

export function CalendlyButton({ text, className }: CalendlyButtonProps) {
  useEffect(() => {
    // 1. Charger le CSS de Calendly si absent
    if (!document.querySelector('link[href*="calendly.com/assets/external/widget.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://assets.calendly.com/assets/external/widget.css';
      document.head.appendChild(link);
    }

    // 2. Charger le Script de Calendly si absent
    if (!window.Calendly && !document.querySelector('script[src*="calendly.com/assets/external/widget.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleClick = () => {
    if (window.Calendly && window.Calendly.initPopupWidget) {
      window.Calendly.initPopupWidget({
        url: 'https://calendly.com/stryv-revolution/info?hide_event_type_details=1&hide_gdpr_banner=1&background_color=303030&text_color=e6e6e6&primary_color=dafa72',
      });
    } else {
      console.warn('Calendly pas encore chargé, nouvel essai...');
      // Petit fallback si l'utilisateur clique très vite
      setTimeout(() => {
         if (window.Calendly) {
            window.Calendly.initPopupWidget({
                url: 'https://calendly.com/stryv-revolution/info?hide_event_type_details=1&hide_gdpr_banner=1&background_color=303030&text_color=e6e6e6&primary_color=dafa72',
            });
         }
      }, 500);
    }
  };

  return (
    <>
      {/* OVERRIDE CSS AGRESSIF 
         Cela force le popup à garder l'aspect "Carte" même sur mobile 
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Force les coins arrondis et la taille réduite sur TOUS les écrans */
        .calendly-overlay .calendly-popup {
            max-height: 80% !important;       /* Hauteur max 80% */
            max-width: 90% !important;        /* Largeur max 90% */
            width: 550px !important;          /* Largeur idéale desktop */
            border-radius: 24px !important;   /* Coins arrondis forcés */
            top: 50% !important;              /* Centrage vertical */
            left: 50% !important;             /* Centrage horizontal */
            transform: translate(-50%, -50%) !important;
            position: fixed !important;
            overflow: hidden !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6) !important;
        }

        /* Ajustement spécifique mobile pour éviter le plein écran */
        @media (max-width: 768px) {
            .calendly-overlay .calendly-popup {
                width: 90% !important;        /* Marge sur les côtés */
                height: 70% !important;       /* Hauteur réduite */
                min-width: auto !important;
            }
            
            /* S'assure que le contenu interne suit l'arrondi */
            .calendly-popup-content {
                border-radius: 24px !important;
            }

            /* Repositionne la croix de fermeture si nécessaire */
            .calendly-overlay .calendly-close-overlay {
                top: 5% !important;
                right: 8% !important;
                color: white !important;
            }
        }
      `}} />

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          handleClick();
        }}
        className={className}
      >
        {text}
      </button>
    </>
  );
}