// lib/morpho/parse.ts

export interface MorphoExtracted {
  body_fat_pct?: number;
  estimated_muscle_mass_kg?: number;
  visceral_fat_level?: number;
  dimensions?: {
    waist_cm?: number;
    hips_cm?: number;
    chest_cm?: number;
    arm_cm_l?: number;
    arm_cm_r?: number;
    leg_cm_l?: number;
    leg_cm_r?: number;
    thigh_cm_l?: number;
    thigh_cm_r?: number;
    calf_cm_l?: number;
    calf_cm_r?: number;
  };
  asymmetries?: {
    arm_diff_cm?: number;
    leg_diff_cm?: number;
    shoulder_imbalance_cm?: number;
    hip_imbalance_cm?: number;
    posture_notes?: string;
  };
}

/**
 * Parses OpenAI Vision responses and extracts morphological metrics.
 * Handles multiple photo angles (front, side, back) and combines results.
 *
 * @param visionResults Array of text responses from OpenAI Vision API
 * @returns Extracted morphological data with optional fields
 */
export function parseMorphoResponses(visionResults: string[]): MorphoExtracted {
  const combined = visionResults.join('\n');

  const extracted: MorphoExtracted = {
    dimensions: {},
    asymmetries: {},
  };

  // Extract body_fat_pct (e.g., "18% body fat", "body fat: 18%", "Body fat: 22%")
  const bodyFatMatch = combined.match(/(?:(\d+\.?\d*)\s*%\s*body\s*fat|body\s*fat\s*:?\s*(\d+\.?\d*)\s*%)/i);
  if (bodyFatMatch) {
    extracted.body_fat_pct = parseFloat(bodyFatMatch[1] || bodyFatMatch[2]);
  }

  // Extract dimensions (e.g., "waist: 78cm" or "78cm waist")
  const waistMatch = combined.match(/waist\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (waistMatch && extracted.dimensions) {
    extracted.dimensions.waist_cm = parseFloat(waistMatch[1]);
  }

  const hipsMatch = combined.match(/hips?\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (hipsMatch && extracted.dimensions) {
    extracted.dimensions.hips_cm = parseFloat(hipsMatch[1]);
  }

  const chestMatch = combined.match(/chest\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (chestMatch && extracted.dimensions) {
    extracted.dimensions.chest_cm = parseFloat(chestMatch[1]);
  }

  // Extract arm dimensions (left/right)
  const armLMatch = combined.match(/(?:left|L)\s*arm\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (armLMatch && extracted.dimensions) {
    extracted.dimensions.arm_cm_l = parseFloat(armLMatch[1]);
  }

  const armRMatch = combined.match(/(?:right|R)\s*arm\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (armRMatch && extracted.dimensions) {
    extracted.dimensions.arm_cm_r = parseFloat(armRMatch[1]);
  }

  // Extract leg dimensions (left/right)
  const legLMatch = combined.match(/(?:left|L)\s*leg\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (legLMatch && extracted.dimensions) {
    extracted.dimensions.leg_cm_l = parseFloat(legLMatch[1]);
  }

  const legRMatch = combined.match(/(?:right|R)\s*leg\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (legRMatch && extracted.dimensions) {
    extracted.dimensions.leg_cm_r = parseFloat(legRMatch[1]);
  }

  // Extract thigh dimensions
  const thighLMatch = combined.match(/(?:left|L)\s*thigh\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (thighLMatch && extracted.dimensions) {
    extracted.dimensions.thigh_cm_l = parseFloat(thighLMatch[1]);
  }

  const thighRMatch = combined.match(/(?:right|R)\s*thigh\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (thighRMatch && extracted.dimensions) {
    extracted.dimensions.thigh_cm_r = parseFloat(thighRMatch[1]);
  }

  // Extract calf dimensions
  const calfLMatch = combined.match(/(?:left|L)\s*calf\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (calfLMatch && extracted.dimensions) {
    extracted.dimensions.calf_cm_l = parseFloat(calfLMatch[1]);
  }

  const calfRMatch = combined.match(/(?:right|R)\s*calf\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (calfRMatch && extracted.dimensions) {
    extracted.dimensions.calf_cm_r = parseFloat(calfRMatch[1]);
  }

  // Extract asymmetries (e.g., "left shoulder 2cm higher" or "arm difference: 1.2cm")
  const armDiffMatch = combined.match(/arm\s*(?:difference|diff)\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (armDiffMatch && extracted.asymmetries) {
    extracted.asymmetries.arm_diff_cm = parseFloat(armDiffMatch[1]);
  }

  const legDiffMatch = combined.match(/leg\s*(?:difference|diff)\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (legDiffMatch && extracted.asymmetries) {
    extracted.asymmetries.leg_diff_cm = parseFloat(legDiffMatch[1]);
  }

  const shoulderMatch = combined.match(/shoulder\s*(?:imbalance|difference)\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (shoulderMatch && extracted.asymmetries) {
    extracted.asymmetries.shoulder_imbalance_cm = parseFloat(shoulderMatch[1]);
  }

  const hipMatch = combined.match(/hip\s*(?:imbalance|difference)\s*:?\s*(\d+\.?\d*)\s*cm/i);
  if (hipMatch && extracted.asymmetries) {
    extracted.asymmetries.hip_imbalance_cm = parseFloat(hipMatch[1]);
  }

  // Extract posture notes
  const postureMatch = combined.match(/posture\s*:?\s*([^\n.]+)/i);
  if (postureMatch && extracted.asymmetries) {
    extracted.asymmetries.posture_notes = postureMatch[1].trim();
  }

  return extracted;
}

/**
 * Estimates muscle mass from client weight and body fat percentage.
 * Uses Katch-McArdle derived formula: lean_mass × 0.85
 *
 * @param clientWeight Client weight in kg
 * @param bodyFatPct Body fat percentage (0-100)
 * @returns Estimated muscle mass in kg
 */
export function estimateMuscleFromBiometrics(clientWeight: number, bodyFatPct: number): number {
  // Guard: ensure valid inputs
  if (clientWeight <= 0 || bodyFatPct < 0 || bodyFatPct > 100) {
    return 0;
  }

  // Lean mass = weight × (1 - body_fat_pct/100)
  const leanMass = clientWeight * (1 - bodyFatPct / 100);

  // Muscle mass ≈ lean mass × 0.85 (accounting for organs, water, etc.)
  return leanMass * 0.85;
}
