'use client';
import Script from 'next/script';

export default function FaqMetabolicSchema() {
  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Pourquoi ai-je envie de dormir 1h après chaque repas ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "C'est un signe clinique d'instabilité glycémique. Votre corps produit une réponse insulinique excessive (hypoglycémie réactionnelle). L'analyse IPT détecte cette incapacité à gérer les glucides pour adapter votre nutrition."
        }
      },
      {
        "@type": "Question",
        "name": "Je mange énormément mais je n'arrive pas à prendre de la masse (Hard Gainer). Pourquoi ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Ce n'est pas un manque d'entraînement. C'est souvent dû à un métabolisme hyper-adaptatif (NEAT élevé) ou une capacité digestive saturée. Si votre intestin n'absorbe pas les nutriments, vous ne construirez pas de muscle. L'IPT analyse votre efficacité digestive pour débloquer l'anabolisme."
        }
      },
      {
        "@type": "Question",
        "name": "Le stress m'empêche-t-il vraiment de prendre du muscle ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Absolument. Le stress chronique élève le cortisol, une hormone 'catabolique' qui détruit le tissu musculaire pour produire de l'énergie. C'est l'ennemi n°1 de la testostérone. Nous mesurons votre charge de stress pour protéger vos gains."
        }
      },
      {
        "@type": "Question",
        "name": "Je mange peu et je fais du sport, mais je ne perds pas de poids.",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Vous êtes probablement en 'Dette Métabolique'. Un stress chronique couplé à un déficit calorique bloque la lipolyse et favorise le stockage abdominal. Notre diagnostic vérifie l'état de votre axe HPA avant tout régime."
        }
      },
      {
        "@type": "Question",
        "name": "Mes performances stagnent malgré un entraînement intense. Que faire ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Le plateau est souvent un problème nerveux, pas musculaire. Si votre Variabilité Cardiaque (VFC) est basse, s'entraîner plus vous rendra moins performant. L'IPT permet de calibrer l'intensité pour relancer la progression."
        }
      },
      {
        "@type": "Question",
        "name": "Qu'est-ce que l'Indice de Potentiel de Transformation (IPT) ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "L'IPT est un algorithme propriétaire STRYV lab qui croise 273 points de données biologiques. Il calcule votre score de 'capacité à changer'. Si votre score est bas (<50), nous devons réparer votre métabolisme avant d'intensifier l'entraînement."
        }
      }
    ]
  };

  return (
    <Script
      id="faq-metabolic-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
    />
  );
}