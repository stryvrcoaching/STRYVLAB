'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Cal, { getCalApi } from "@calcom/embed-react";

interface CalConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalConsultationModal({ isOpen, onClose }: CalConsultationModalProps) {
  
  // Initialisation de l'API Cal
  useEffect(() => {
    if (isOpen) {
      // Bloquer le scroll du body quand la modale est ouverte
      document.body.style.overflow = 'hidden';

      (async function () {
        // 1. Initialisation explicite sur le script EU
        const cal = await getCalApi("https://app.cal.eu/embed/embed.js");
        
        cal("ui", {
          styles: {
            branding: {
              brandColor: "#0e8c5b",
            },
          },
          theme: "light", // On force le light pour éviter les conflits de contraste
          hideEventTypeDetails: false,
          layout: "month_view",
        });
      })();
    }

    return () => {
      // Réactiver le scroll à la fermeture
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      
      {/* Overlay Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-4xl h-[85vh] md:h-[90vh] mx-4 md:mx-6 bg-surface rounded-card shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-surface shrink-0">
          <div>
            <h2 className="text-lg font-bold text-primary">Réserver une consultation</h2>
            <p className="text-xs text-secondary mt-0.5">Échange stratégique avec un coach STRYV lab</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-surface hover:active:transition-all duration-200 flex items-center justify-center text-secondary hover:text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Zone Cal.com (Scrollable) */}
        <div className="flex-1 bg-white w-full relative overflow-hidden">
          <Cal
            // 2. CORRECTION CRITIQUE : Slug seul + Origine EU séparée
            calLink="virtus-smartfit/consultation" 
            calOrigin="https://app.cal.eu"
            
            style={{ width: "100%", height: "100%", overflow: "scroll" }}
            config={{ layout: 'month_view' }}
          />
        </div>

      </div>
    </div>
  );
}