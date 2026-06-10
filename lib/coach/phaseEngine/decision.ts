import { OptimalPhaseType } from './types';

interface DecisionInput {
  currentWeight: number;
  targetWeight: number;
  weeksRemaining: number | null;
  cnsOverload: boolean;
}

interface DecisionOutput {
  phase: OptimalPhaseType;
  intensity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  vetoTriggered: boolean;
  reasoning: string;
}

export function computeOptimalPhase(input: DecisionInput): DecisionOutput {
  // 1. LE VETO PHYSIOLOGIQUE ABSOLU (SNC Overload)
  if (input.cnsOverload) {
    return {
      phase: 'DELOAD',
      intensity: 'LOW',
      vetoTriggered: true,
      reasoning: "VETO BIOLOGIQUE ACTIVÉ : Le système nerveux central est en surcharge (RHR/Fatigue). Risque de catabolisme ou blessure. Réduction immédiate du volume requise."
    };
  }

  // 2. GESTION DE LA SEMAINE FINALE
  if (input.weeksRemaining !== null && input.weeksRemaining <= 1 && input.weeksRemaining >= 0) {
    return {
      phase: 'PEAK_WEEK',
      intensity: 'LOW',
      vetoTriggered: false,
      reasoning: "Échéance à moins de 7 jours. Déplétion/recharge glycogénique et gestion hydrique prioritaire."
    };
  }

  // 3. CALCUL DU TAUX DE VARIATION REQUIS (Rate of Loss / Gain)
  const weightDelta = input.currentWeight - input.targetWeight; 
  
  if (weightDelta > 0 && input.weeksRemaining !== null && input.weeksRemaining > 0) {
    // Cas de perte de poids
    const requiredLossPerWeek = weightDelta / input.weeksRemaining;
    const lossPercentagePerWeek = (requiredLossPerWeek / input.currentWeight) * 100;

    if (lossPercentagePerWeek > 0.8) {
      return {
        phase: 'AGGRESSIVE_CUT',
        intensity: 'HIGH',
        vetoTriggered: false,
        reasoning: `Perte requise très agressive (${lossPercentagePerWeek.toFixed(2)}% du poids par semaine). Déficit maximal requis avec maintien des charges lourdes.`
      };
    } else {
      return {
        phase: 'MODERATE_CUT',
        intensity: 'MODERATE',
        vetoTriggered: false,
        reasoning: "Perte de poids soutenable. Maintien d'un déficit modéré avec volume d'entraînement standard."
      };
    }
  }

  // 4. CAS PAR DÉFAUT OU PRISE DE MASSE
  if (weightDelta < 0) {
    return {
      phase: 'LEAN_BULK',
      intensity: 'HIGH',
      vetoTriggered: false,
      reasoning: "Objectif d'hypertrophie. Surplus calorique léger requis."
    };
  }

  return {
    phase: 'MAINTENANCE',
    intensity: 'MODERATE',
    vetoTriggered: false,
    reasoning: "Poids cible atteint ou aucune contrainte temporelle agressive détectée."
  };
}
