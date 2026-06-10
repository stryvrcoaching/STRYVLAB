// =====================================================
// STRYV lab IPT - TYPESCRIPT TYPES
// À placer dans: types/genesis.ts
// =====================================================

/**
 * Question du questionnaire STRYV lab
 */
export interface GenesisQuestion {
  id: string;
  dimension: string;
  patterns: string[];
  role: 'TRIGGER' | 'PRIMARY' | 'SECONDARY';
  question: string;
  type: 'Numérique' | 'Choix unique' | 'Choix multiple' | 'Échelle 1-10';
  options: string[];
  triggerCondition: string;
  skipCondition: string;
  rootCauseLink: string;
  impactScore: number;
  scientificRef: string;
}

/**
 * Réponse utilisateur à une question
 */
export type QuestionResponse = string | number | string[];

/**
 * Collection de toutes les réponses
 */
export interface IPTResponses {
  [questionId: string]: QuestionResponse;
}

/**
 * Soumission IPT complète
 */
export interface IPTSubmission {
  id: string;
  email?: string;
  userId?: string;
  sessionId: string;
  startedAt: Date;
  completedAt?: Date;
  lastUpdatedAt: Date;
  currentStep: number;
  totalSteps: number;
  isCompleted: boolean;
  responses: IPTResponses;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Score IPT calculé
 */
export interface IPTScore {
  id: string;
  submissionId: string;
  
  // Score global
  iptScore: number; // 0-100
  iptCategory: 'CRITIQUE' | 'FAIBLE' | 'MOYEN' | 'ÉLEVÉ' | 'EXCELLENT';
  
  // Scores par pilier
  metabolicScore: number;
  infrastructureScore: number;
  psychologyScore: number;
  physiologyScore: number;
  adherenceScore: number;
  
  // Patterns détectés
  detectedPatterns: DetectedPattern[];
  
  // Red flags
  redFlags: RedFlag[];
  
  // Root causes
  rootCauses: RootCause[];
  
  // Recommandations
  recommendations: Recommendation[];
  
  // Scores détaillés
  detailedScores: DetailedScores;
  
  calculatedAt: Date;
  createdAt: Date;
}

/**
 * Pattern détecté (P1-P12)
 */
export interface DetectedPattern {
  patternId: string; // P1, P2, etc.
  patternName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  description: string;
  relatedQuestions: string[];
  impact: string;
}

/**
 * Red flag identifié
 */
export interface RedFlag {
  type: 'MEDICAL' | 'METABOLIC' | 'PSYCHOLOGICAL' | 'HORMONAL' | 'ENVIRONMENTAL';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  actionRequired: string;
  relatedPatterns: string[];
}

/**
 * Root cause identifiée
 */
export interface RootCause {
  id: string;
  category: string;
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
  scientificBasis: string;
}

/**
 * Recommandation personnalisée
 */
export interface Recommendation {
  category: 'NUTRITION' | 'TRAINING' | 'RECOVERY' | 'MEDICAL' | 'LIFESTYLE';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionSteps: string[];
  expectedImpact: string;
  timeline: string;
}

/**
 * Scores détaillés par dimension
 */
export interface DetailedScores {
  [dimension: string]: {
    score: number;
    weight: number;
    breakdown: {
      [subdimension: string]: number;
    };
  };
}

/**
 * Catégorie IPT avec mapping
 */
export interface IPTCategory {
  scoreMin: number;
  scoreMax: number;
  category: 'CRITIQUE' | 'FAIBLE' | 'MOYEN' | 'ÉLEVÉ' | 'EXCELLENT';
  description: string;
  color: string;
}

/**
 * Transaction paiement Stripe
 */
export interface PaymentTransaction {
  id: string;
  submissionId: string;
  stripePaymentIntentId: string;
  stripeCustomerId?: string;
  stripeSessionId?: string;
  amount: number;
  currency: string;
  tier: 'RAPPORT' | 'PROTOCOL' | 'COACHING';
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  paymentMethod?: string;
  receiptUrl?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rapport PDF généré
 */
export interface GeneratedReport {
  id: string;
  submissionId: string;
  scoreId: string;
  reportType: 'CLIENT' | 'COACH';
  pdfUrl?: string;
  pdfSize?: number;
  sentToEmail?: string;
  sentAt?: Date;
  emailStatus: 'pending' | 'sent' | 'failed';
  generatedAt: Date;
  createdAt: Date;
}

/**
 * État du questionnaire (pour React state)
 */
export interface QuestionnaireState {
  currentStep: number;
  totalSteps: number;
  currentModule: string;
  currentQuestionIndex: number;
  responses: IPTResponses;
  visibleQuestions: string[]; // IDs des questions à afficher
  completedModules: string[];
  timeSpent: number; // secondes
  lastSaveAt?: Date;
}

/**
 * Pilier de scoring (5 pillars)
 */
export type ScoringPillar = 
  | 'METABOLIC'      // 30%
  | 'INFRASTRUCTURE' // 25%
  | 'PSYCHOLOGY'     // 20%
  | 'PHYSIOLOGY'     // 15%
  | 'ADHERENCE';     // 10%

/**
 * Poids des pillars
 */
export const PILLAR_WEIGHTS: Record<ScoringPillar, number> = {
  METABOLIC: 0.30,
  INFRASTRUCTURE: 0.25,
  PSYCHOLOGY: 0.20,
  PHYSIOLOGY: 0.15,
  ADHERENCE: 0.10,
};

/**
 * Tiers de pricing
 */
export interface PricingTier {
  id: 'RAPPORT' | 'PROTOCOL' | 'COACHING';
  name: string;
  price: number;
  currency: string;
  stripePriceId: string;
  features: string[];
  deliverables: string[];
  recommended?: boolean;
}

/**
 * Configuration questionnaire
 */
export interface QuestionnaireConfig {
  autoSaveInterval: number; // ms
  progressSaveThreshold: number; // nombre de questions avant auto-save
  sessionTimeout: number; // ms
  allowSkip: boolean;
  showProgress: boolean;
  showTimeEstimate: boolean;
}

/**
 * Statistiques de session
 */
export interface SessionStats {
  questionsAnswered: number;
  questionsTotal: number;
  completionPercentage: number;
  timeElapsed: number; // secondes
  timeEstimatedRemaining: number; // secondes
  averageTimePerQuestion: number; // secondes
}

/**
 * Module du questionnaire
 */
export interface QuestionnaireModule {
  id: string;
  name: string;
  description: string;
  order: number;
  questions: GenesisQuestion[];
  estimatedTime: number; // minutes
  icon?: string;
}

/**
 * Contexte utilisateur (pour logique conditionnelle)
 */
export interface UserContext {
  age?: number;
  sex?: 'Homme' | 'Femme';
  trainingAge?: string;
  goal?: string;
  medicalConditions?: string[];
  // ... autres données nécessaires pour triggers
}

/**
 * Résultat validation question
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Helper type pour les options de questions
 */
export type QuestionOption = string;

/**
 * Helper type pour les réponses multiples
 */
export type MultipleChoiceResponse = string[];

/**
 * Helper type pour les réponses numériques
 */
export type NumericResponse = number;

/**
 * Helper type pour les réponses échelle
 */
export type ScaleResponse = number; // 1-10
