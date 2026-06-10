/**
 * VIRTUS Smart fit MACRO CALCULATOR - Forensic Metabolic Analysis
 * Méthodologie: Katch-McArdle + NEAT/EAT + Stratification BF% + Boer Formula
 */

export function calculateOptimalMacros(data) {
  // Conversion et sécurisation des valeurs numériques
  const weight = Math.max(0, parseFloat(data.weight) || 0);
  const height = Math.max(0, parseFloat(data.height) || 0);
  const age = Math.max(0, parseFloat(data.age) || 0);
  const bodyFat = data.bodyFat ? parseFloat(data.bodyFat) : null;
  const dailySteps = Math.max(0, parseFloat(data.steps) || 0);
  const weeklyWorkouts = Math.max(0, parseFloat(data.workouts) || 0);

  // ========================================
  // PHASE 1: LEAN BODY MASS (LBM)
  // ========================================
  let estimatedBF;
  let leanMass;
  
  if (bodyFat && bodyFat > 0) {
    estimatedBF = bodyFat;
    leanMass = weight * (1 - estimatedBF / 100);
  } else {
    // Boer Formula
    if (data.gender === 'male') {
      leanMass = (0.407 * weight) + (0.267 * height) - 19.2;
    } else {
      leanMass = (0.252 * weight) + (0.473 * height) - 48.3;
    }
    leanMass = Math.max(weight * 0.5, Math.min(weight, leanMass));
    estimatedBF = ((weight - leanMass) / weight) * 100;
  }

  // ========================================
  // PHASE 2: BMR (KATCH-MCARDLE)
  // ========================================
  let bmr = 370 + (21.6 * leanMass);
  
  if (age > 30) {
    const ageDecrement = Math.floor((age - 30) / 10) * 0.02;
    bmr = bmr * (1 - ageDecrement);
  }

  // ========================================
  // PHASE 3: TDEE FORENSIQUE (NEAT + EAT + TEF)
  // ========================================
  const neat = dailySteps * 0.04;
  
  const trainingLoad = { 0: 0, 1: 200, 2: 250, 3: 325, 4: 400, 5: 475, 6: 550, 7: 625 };
  const eatPerDay = trainingLoad[Math.min(Math.floor(weeklyWorkouts), 7)] || 325;
  
  const tef = bmr * 0.1; // Approche conservatrice (10% BMR)
  const tdeeForensique = Math.round(bmr + neat + eatPerDay + tef);

  // ========================================
  // PHASE 4: STRATIFICATION DE L'OBJECTIF
  // ========================================
  let targetCalories;
  let surplusOrDeficit = 0;

  if (data.goal === 'deficit') {
    let deficitFactor;
    if (estimatedBF > 25) deficitFactor = 0.25;
    else if (estimatedBF > 20) deficitFactor = 0.20;
    else if (estimatedBF > 15) deficitFactor = 0.15;
    else deficitFactor = 0.12;
    
    if (weeklyWorkouts >= 5) {
      deficitFactor = Math.max(0.12, deficitFactor - 0.03);
    }
    
    surplusOrDeficit = -Math.round(tdeeForensique * deficitFactor);
  } else if (data.goal === 'surplus') {
    if (estimatedBF < 12) surplusOrDeficit = 220;
    else if (estimatedBF < 15) surplusOrDeficit = 180;
    else if (estimatedBF < 18) surplusOrDeficit = 150;
    else surplusOrDeficit = 100;
  }
  
  targetCalories = tdeeForensique + surplusOrDeficit;

  // ========================================
  // PHASE 5: MACROS
  // ========================================
  
  // 1. Protéines (Optimisé légèrement)
  let proteinMultiplier;
  if (data.goal === 'deficit') {
    proteinMultiplier = estimatedBF > 20 ? 2.5 : 2.8; // ← Légèrement augmenté
  } else if (data.goal === 'surplus') {
    proteinMultiplier = 2.2; // ← Réduit légèrement (anabolisme)
  } else {
    proteinMultiplier = 2.0; // ← Réduit maintenance
  }
  
  const protein = Math.round(leanMass * proteinMultiplier);

  // 2. Lipides (Inchangé - Parfait)
  const minFatsMultiplier = data.gender === 'female' ? 0.9 : 0.7;
  const minFats = weight * minFatsMultiplier;
  
  const fatsPercent = data.goal === 'surplus' ? 0.22 : 0.25;
  const calculatedFats = (targetCalories * fatsPercent) / 9;
  const fats = Math.round(Math.max(minFats, calculatedFats));

  // 3. Glucides
  const remainingCalories = targetCalories - (protein * 4) - (fats * 9);
  const carbs = Math.max(0, Math.round(remainingCalories / 4));

  // ========================================
  // PHASE 6: ALERTES (Optimisé genre pour BF%)
  // ========================================
  const warnings = [];
  
  if (protein < leanMass * 1.8) {
    warnings.push('⚠️ Protéines sous 1.8g/kg LBM: risque de catabolisme.');
  }
  
  if (fats < weight * (data.gender === 'female' ? 0.6 : 0.5)) {
    warnings.push('⚠️ Lipides critiques: risque de dérèglement hormonal.');
  }
  
  if (weeklyWorkouts >= 4 && carbs < weight * 2) {
    warnings.push('⚠️ Glucides bas: performance et récupération compromises.');
  }
  
  // Warning surplus avec seuil selon genre
  const maxBFForSurplus = data.gender === 'male' ? 18 : 28;
  if (data.goal === 'surplus' && estimatedBF > maxBFForSurplus) {
    warnings.push('⚠️ BF% élevé: un léger cut est conseillé avant un surplus.');
  }

  return {
    calories: targetCalories,
    tdee: tdeeForensique,
    leanMass: Math.round(leanMass * 10) / 10,
    estimatedBF: Math.round(estimatedBF * 10) / 10,
    macros: { p: protein, f: fats, c: carbs },
    ratios: {
      p: Math.round((protein / leanMass) * 10) / 10,
      f: Math.round((fats / weight) * 10) / 10,
      c: Math.round((carbs / weight) * 10) / 10
    },
    percents: {
      p: Math.round((protein * 4 / targetCalories) * 100),
      f: Math.round((fats * 9 / targetCalories) * 100),
      c: Math.round((carbs * 4 / targetCalories) * 100)
    },
    breakdown: {
      bmr: Math.round(bmr),
      neat: Math.round(neat),
      eat: Math.round(eatPerDay), 
      tef: Math.round(tef)
    },
    adjustment: surplusOrDeficit,
    warnings
  };
}

export function validateMacroInputs(data) {
  const errors = [];
  if (!data.weight || data.weight < 40 || data.weight > 250) errors.push('Poids hors limites (40-250kg)');
  if (!data.height || data.height < 140 || data.height > 220) errors.push('Taille hors limites (140-220cm)');
  if (!data.age || data.age < 15 || data.age > 85) errors.push('Âge hors limites (15-85 ans)');
  return errors;
}