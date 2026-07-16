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
  es: {
    common: {
      calculate: "Calcular",
      backToTools: "Hub de Herramientas",
      labLabel: "Laboratorio de precisión",
      consultation: "Consulta"
    },
    toolsPage: {
      title: "Herramientas",
      subtitle: "Optimiza tu fisiología con nuestros avanzados algoritmos de cálculo biométrico.",
      access: "Iniciar Auditoría",
      tools: {
        macros: { title: "Cálculo de Macros", description: "Suma energética real (TMB, NEAT, EAT) para recomposición." },
        bodyFat: { title: "Grasa Corporal", description: "Análisis de composición corporal vía algoritmo de la Marina de EE. UU." },
        cycleSync: { title: "Cycle Sync", description: "Optimización hormonal de la nutrición y el entrenamiento." },
        carbCycling: { title: "Carb Cycling", description: "Estratificación cíclica de carbohidratos según la actividad." },
        hrZones: { title: "Zonas FC", description: "Definición de zonas de frecuencia cardíaca objetivo para resistencia." },
        oneRM: { title: "Calculadora 1RM", description: "Estimación de carga máxima y zonas de fuerza teóricas." }
      }
    },
    oneRMPage: {
      title: "CALC 1RM",
      category: "Rendimiento",
      pillar1Title: "Precisión de Fuerza",
      pillar1Desc: "Calcula tu repetición máxima teórica para calibrar tus ciclos de fuerza.",
      pillar2Title: "Zonas de Carga",
      pillar2Desc: "Distribución automática de porcentajes para hipertrofia y potencia."
    },
    cycleSyncPage: {
      title: "CYCLE SYNC",
      category: "Fisiología",
      pillar1Title: "Fase Folicular",
      pillar1Desc: "Máxima sensibilidad a la insulina. Ventana ideal para volumen e intensidad.",
      pillar2Title: "Fase Lútea",
      pillar2Desc: "Metabolismo aumentado. Ajuste calórico para prevenir el catabolismo."
    }
  }
};

export const getTranslation = (lang: string) => {
  // On force TS à considérer lang comme une clé valide de notre objet
  const code = (lang as Language) || 'fr';
  return translations[code] || translations.fr;
};