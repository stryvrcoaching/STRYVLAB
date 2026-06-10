export type Language = 'fr' | 'en' | 'es';

// On explicite le type de l'objet pour que TS accepte l'indexation dynamique
export const translations: Record<Language, any> = {
  fr: {
    common: {
      calculate: "Calculer",
      backToTools: "Hub Outils",
      labLabel: "Laboratoire de précision",
      consultation: "Consultation"
    },
    toolsPage: {
      title: "Outils",
      subtitle: "Optimisez votre physiologie grâce à nos algorithmes de calcul biométriques avancés.",
      access: "Lancer l'audit",
      tools: {
        macros: { title: "Macro Calcul", description: "Sommation énergétique réelle (BMR, NEAT, EAT) pour recomposition." },
        bodyFat: { title: "Body Fat", description: "Analyse de composition corporelle via algorithme US Navy." },
        cycleSync: { title: "Cycle Sync", description: "Optimisation hormonale de la nutrition et de l'entraînement." },
        carbCycling: { title: "Carb Cycling", description: "Stratification cyclique des glucides selon l'activité." },
        hrZones: { title: "HR Zones", description: "Définition des zones cardiaques cibles pour l'endurance." },
        oneRM: { title: "1RM Calc", description: "Estimation de charge maximale et zones de force théoriques." }
      }
    },
    oneRMPage: {
      title: "1RM CALC",
      category: "Performance",
      pillar1Title: "Précision Force",
      pillar1Desc: "Calculez votre répétition maximale théorique pour calibrer vos cycles de force.",
      pillar2Title: "Zones de Charge",
      pillar2Desc: "Distribution automatique des pourcentages pour l'hypertrophie et la puissance."
    },
    cycleSyncPage: {
      title: "CYCLE SYNC",
      category: "Physiologie",
      pillar1Title: "Phase Folliculaire",
      pillar1Desc: "Sensibilité maximale à l'insuline. Fenêtre idéale pour le volume et l'intensité.",
      pillar2Title: "Phase Lutéale",
      pillar2Desc: "Métabolisme augmenté. Ajustement calorique pour prévenir le catabolisme."
    }
  },
  en: {
    common: {
      calculate: "Calculate",
      backToTools: "Tools Hub",
      labLabel: "Precision Laboratory",
      consultation: "Consultation"
    },
    toolsPage: {
      title: "Tools",
      subtitle: "Optimize your physiology with our advanced biometric calculation algorithms.",
      access: "Launch Audit",
      tools: {
        macros: { title: "Macro Calc", description: "Real energy summation (BMR, NEAT, EAT) for recomposition." },
        bodyFat: { title: "Body Fat", description: "Body composition analysis via US Navy algorithm." },
        cycleSync: { title: "Cycle Sync", description: "Hormonal optimization of nutrition and training." },
        carbCycling: { title: "Carb Cycling", description: "Cyclic carbohydrate stratification based on activity." },
        hrZones: { title: "HR Zones", description: "Definition of target heart rate zones for endurance." },
        oneRM: { title: "1RM Calc", description: "Estimation of maximum load and theoretical strength zones." }
      }
    },
    oneRMPage: {
      title: "1RM CALC",
      category: "Performance",
      pillar1Title: "Strength Precision",
      pillar1Desc: "Calculate your theoretical one-rep max to calibrate your strength cycles.",
      pillar2Title: "Loading Zones",
      pillar2Desc: "Automatic distribution of percentages for hypertrophy and power."
    },
    cycleSyncPage: {
      title: "CYCLE SYNC",
      category: "Physiology",
      pillar1Title: "Follicular Phase",
      pillar1Desc: "Maximum insulin sensitivity. Ideal window for volume and intensity.",
      pillar2Title: "Luteal Phase",
      pillar2Desc: "Increased metabolism. Caloric adjustment to prevent catabolism."
    }
  },
  // On ajoute une clé 'es' vide pour éviter l'erreur de propriété manquante
  // Ou on utilise le fallback dans getTranslation
  es: {
    common: { calculate: "Calcular", backToTools: "Panel", labLabel: "Laboratorio", consultation: "Consulta" },
    toolsPage: { title: "Herramientas", subtitle: "Optimiza tu fisiología.", access: "Iniciar", tools: {} }
  }
};

export const getTranslation = (lang: string) => {
  // On force TS à considérer lang comme une clé valide de notre objet
  const code = (lang as Language) || 'fr';
  return translations[code] || translations.fr;
};