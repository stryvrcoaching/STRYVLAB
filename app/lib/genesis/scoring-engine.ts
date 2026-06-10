// app/lib/genesis/scoring-engine.ts

// 1. DÉFINITION DES TYPES (Pour la sécurité TypeScript)
export interface DetailedScores {
  metabolicFlexibility: number;
  circadianAlignment: number;
  inflammatoryStatus: number;
  nutrientSensing: number;
  stressResilience: number;
}

export interface GenesisResult {
  globalScore: number;
  detailedScores: DetailedScores;
  detectedPatterns: string[];
  redFlags: string[];
  rootCauses: string[];
  recommendations: string[];
}

// 2. MOTEUR DE SCORING
export class GenesisScoringEngine {
  // DÉCLARATION OBLIGATOIRE DES PROPRIÉTÉS (C'est ce qui manquait)
  private responses: Record<string, any>;
  private detailedScores: DetailedScores;
  private detectedPatterns: string[];
  private redFlags: string[];
  private rootCauses: string[];

  // CONSTRUCTEUR
  constructor(responses: Record<string, any>) {
    this.responses = responses;
    
    // Initialisation des valeurs par défaut
    this.detailedScores = {
      metabolicFlexibility: 0,
      circadianAlignment: 0,
      inflammatoryStatus: 0,
      nutrientSensing: 0,
      stressResilience: 0
    };
    
    this.detectedPatterns = [];
    this.redFlags = [];
    this.rootCauses = [];
  }

  // MÉTHODE PRINCIPALE
  public calculate(): GenesisResult {
    // 1. Calcul des scores détaillés
    this.calculateDetailedScores();

    // 2. Détection des patterns
    this.detectPatterns();

    // 3. Identification des Red Flags
    this.identifyRedFlags();

    // 4. Identification des causes racines
    this.identifyRootCauses();

    // 5. Calcul du score global (Moyenne pondérée si nécessaire)
    const globalScore = this.computeGlobalScore();

    return {
      globalScore,
      detailedScores: this.detailedScores,
      detectedPatterns: this.detectedPatterns,
      redFlags: this.redFlags,
      rootCauses: this.rootCauses,
      recommendations: this.generateRecommendations()
    };
  }

  // --- LOGIQUE INTERNE (Méthodes privées) ---

  private calculateDetailedScores(): void {
    // Exemple de logique basique (à adapter selon tes règles métiers exactes)
    
    // Métabolisme
    if (this.responses.energy_dip === 'yes') {
      this.detailedScores.metabolicFlexibility -= 10;
    } else {
      this.detailedScores.metabolicFlexibility += 10;
    }

    // Circadien
    if (this.responses.sleep_quality === 'poor') {
      this.detailedScores.circadianAlignment -= 15;
    }

    // Normalisation des scores entre 0 et 100
    this.normalizeScores();
  }

  private detectPatterns(): void {
    // Exemple: Détection du pattern "Insulin Resistance"
    if (
      this.responses.waist_circumference === 'high' && 
      this.responses.energy_dip === 'yes'
    ) {
      this.detectedPatterns.push('INSULIN_RESISTANCE_PROFILE');
    }
  }

  private identifyRedFlags(): void {
    // Exemple: Symptôme critique
    if (this.responses.chronic_pain === 'severe') {
      this.redFlags.push('HIGH_INFLAMMATION_MARKER');
    }
  }

  private identifyRootCauses(): void {
    if (this.detailedScores.circadianAlignment < 40) {
      this.rootCauses.push('CIRCADIAN_DISRUPTION');
    }
  }

  private computeGlobalScore(): number {
    const scores = Object.values(this.detailedScores);
    const sum = scores.reduce((a, b) => a + b, 0);
    return Math.round(sum / scores.length);
  }

  private normalizeScores(): void {
    // S'assurer que les scores ne dépassent pas 0-100
    (Object.keys(this.detailedScores) as Array<keyof DetailedScores>).forEach(key => {
      this.detailedScores[key] = Math.max(0, Math.min(100, 50 + this.detailedScores[key])); 
      // Note: 50 est la base de départ arbitraire ici
    });
  }

  private generateRecommendations(): string[] {
    const recs: string[] = [];
    if (this.detailedScores.metabolicFlexibility < 50) {
      recs.push("Protocol: Metabolic Reset Level 1");
    }
    return recs;
  }
}