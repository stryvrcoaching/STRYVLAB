'use client';

import { useState } from 'react';

export default function OmniCheckoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);

    try {
      // 1. On définit l'adresse du Cerveau (votre site Vercel)
      // Si on est sur mobile, on a besoin de l'URL complète.
      // Si on est sur le web, '/api' suffirait, mais mettre l'URL complète marche partout.
      const domain = 'https://genesis-system.vercel.app'; 
      
      console.log("Appel du serveur de paiement...");

      // 2. On appelle l'API distante
      const res = await fetch(`${domain}/api/stripe/omni`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Erreur serveur');

      const data = await res.json();

      // 3. Si Stripe nous donne le feu vert, on redirige
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert("Erreur de configuration Stripe.");
        setIsLoading(false);
      }

    } catch (error) {
      console.error("Erreur paiement:", error);
      alert("Impossible de joindre le serveur. Vérifiez votre connexion.");
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        flex items-center justify-center w-full py-4 rounded-xl 
        text-[#1A1A1A] text-[13px] transition-all duration-200 
        shadow-[0_0_15px_-5px_rgba(218,250,114,0.4)]
        ${isLoading 
          ? 'bg-gray-400 cursor-not-allowed opacity-80' 
          : 'bg-[#DAFA72] hover:bg-white'
        }
      `}
    >
      {isLoading ? 'CONNEXION SÉCURISÉE...' : 'Demander l’admission au protocole OMNI'}
    </button>
  );
}