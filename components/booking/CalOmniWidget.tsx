'use client';

import { useEffect } from 'react';
import Cal, { getCalApi } from "@calcom/embed-react";

type CalOmniWidgetProps = {
  onBooked?: () => void;
};

export default function CalOmniWidget({ onBooked }: CalOmniWidgetProps) {
  
  useEffect(() => {
    (async function () {
      const cal = await getCalApi("https://app.cal.eu/embed/embed.js"); // Précision de l'API EU ici aussi par sécurité

      cal("on", {
        action: "bookingSuccessful",
        callback: (e) => {
          onBooked?.();
        },
      });

      cal("ui", {
        styles: {
          branding: {
            brandColor: "#0e8c5b",
          },
        },
        theme: "light", 
        hideEventTypeDetails: true,
        layout: "month_view",
      });
    })();
  }, [onBooked]);

  return (
    <div className="w-full h-full min-h-[600px] bg-white rounded-md overflow-hidden">
      <Cal
        // 1. Le slug uniquement
        calLink="virtus-smartfit/omni-strategy"
        
        // 2. L'origine EU explicite (CRITIQUE pour que ça marche)
        calOrigin="https://app.cal.eu"
        
        style={{ width: "100%", height: "100%", overflow: "scroll" }}
        config={{ layout: 'month_view' }}
      />
    </div>
  );
}