'use client';
import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: "Je suis un 'Hard Gainer', je ne prends pas de masse. Pourquoi ?",
    answer: "Manger plus ne suffit pas si vous n'absorbez pas. Votre métabolisme est probablement hyper-adaptatif (NEAT élevé) ou votre capacité digestive est saturée. L'IPT analyse votre efficacité d'absorption pour enfin débloquer l'anabolisme musculaire."
  },
  {
    question: "Pourquoi ai-je envie de dormir 1h après chaque repas ?",
    answer: "C'est un signe clinique d'instabilité glycémique. Votre corps produit une réponse insulinique excessive (hypoglycémie réactionnelle). L'analyse IPT détecte cette incapacité à gérer les glucides pour adapter votre nutrition."
  },
  {
    question: "Le stress peut-il détruire mes gains musculaires ?",
    answer: "Oui. Le cortisol (hormone du stress) est 'catabolique' : il dégrade le muscle pour fournir de l'énergie rapide. Si votre charge allostatique est trop élevée, vous combattez votre propre corps. Nous devons réduire l'inflammation pour permettre la croissance."
  },
  {
    question: "Je mange peu et je fais du sport, mais je ne perds pas de poids.",
    answer: "Vous êtes probablement en 'Dette Métabolique'. Un stress chronique couplé à un déficit calorique bloque la lipolyse (brûlage de graisses) et favorise le stockage abdominal. Notre diagnostic vérifie l'état de votre axe HPA avant tout régime."
  },
  {
    question: "Mes performances stagnent malgré un entraînement intense.",
    answer: "Le plateau est souvent un signal d'alarme du Système Nerveux Central. S'entraîner plus fort sur un organisme épuisé est contre-productif. Nous analysons votre récupération pour optimiser votre périodisation."
  },
  {
    question: "Qu'est-ce que l'Indice de Potentiel de Transformation (IPT) ?",
    answer: "L'IPT est un algorithme propriétaire STRYV lab qui croise 273 points de données biologiques. Il calcule votre score de 'capacité à changer'. Si votre score est bas (<50), nous devons réparer votre métabolisme avant d'intensifier l'entraînement."
  }
];

export default function MetabolicFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    // FOND #303030 (S'intègre parfaitement à la page principale)
    <section className="bg-[#303030] px-6 sm:px-10 md:px-16 lg:px-24 py-24 border-t border-white/5 font-outfit">
      <div className="max-w-3xl mx-auto">
        
        <div className="mb-12">
          <div className="text-[#DAFA72] text-xs font-bold tracking-widest uppercase mb-4">
            Diagnostic Clinique
          </div>
          <h2 className="text-white text-3xl md:text-4xl font-medium">
            Vos Symptômes Décryptés
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              // CARTE : Fond #252525 (Input style) + Bordure fine
              className={`bg-[#252525] border border-white/5 rounded-xl overflow-hidden transition-all duration-300 ${openIndex === index ? 'border-white/20' : 'hover:border-white/10'}`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
              >
                <span className={`text-sm md:text-base font-medium transition-colors duration-300 pr-8 ${openIndex === index ? 'text-white' : 'text-white/80'}`}>
                  {faq.question}
                </span>
                <span className="flex-shrink-0 text-[#DAFA72]">
                  {openIndex === index ? <Minus size={18} /> : <Plus size={18} />}
                </span>
              </button>
              
              <div 
                className={`overflow-hidden transition-all duration-500 ease-in-out ${openIndex === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                {/* RÉPONSE : text-white/60 (Gris doux) */}
                <p className="px-5 pb-5 text-white/60 text-xs md:text-sm leading-relaxed border-t border-white/5 pt-4">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}