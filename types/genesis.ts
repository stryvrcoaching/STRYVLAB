// =====================================================
// VIRTUS Smart fit IPT — TYPESCRIPT DEFINITIONS
// File: types/genesis.ts
// =====================================================
// Purpose:
// - Définir une structure claire, lisible et stable
// - Compatible frontend (questionnaire, UI, scoring visuel)
// - Compatible backend (scoring, patterns, reporting)
// =====================================================

/* =========================
   ENUMS — LANGAGE VIRTUS Smart fit
   ========================= */

   export type QuestionRole =
   | 'TRIGGER'
   | 'PRIMARY'
   | 'SECONDARY';
 
 export type QuestionType =
   | 'Numérique'
   | 'Choix unique'
   | 'Choix multiple'
   | 'Échelle 1-10';
 
 /* =========================
    CORE QUESTION MODEL
    ========================= */
 
 export interface GenesisQuestion {
   /** Identifiant unique de la question */
   id: string;
 
   /** Dimension principale (Metabolic, Hormonal, Psycho, etc.) */
   dimension: string;
 
   /** Patterns détectables associés à la question */
   patterns: string[];
 
   /** Rôle logique dans le flow IPT */
   role: QuestionRole;
 
   /** Texte affiché à l’utilisateur */
   question: string;
 
   /** Type d’interaction attendu */
   type: QuestionType;
 
   /** Options possibles (si applicable) */
   options: string[];
 
   /** Condition d’apparition (si question conditionnelle) */
   triggerCondition: string;
 
   /** Condition de saut explicite */
   skipCondition: string;
 
   /** Lien avec une cause racine potentielle */
   rootCauseLink: string;
 
   /** Pondération de l’impact sur le scoring */
   impactScore: number;
 
   /** Référence scientifique (interne ou externe) */
   scientificRef: string;
 }
 
 /* =========================
    RESPONSES
    ========================= */
 
 export type QuestionResponse =
   | string
   | number
   | string[];
 
 /** Toutes les réponses d’une session IPT */
 export interface IPTResponses {
   [questionId: string]: QuestionResponse;
 }
 
 /* =========================
    SESSION / PROGRESSION
    ========================= */
 
 export interface SessionStats {
   /** Nombre de questions répondues */
   questionsAnswered: number;
 
   /** Nombre total de questions dans le flow */
   questionsTotal: number;
 
   /** Pourcentage de complétion (0–100) */
   completionPercentage: number;
 
   /** Temps écoulé depuis le début (en secondes) */
   timeElapsed: number;
 
   /** Estimation du temps restant (en secondes) */
   timeEstimatedRemaining: number;
 
   /** Temps moyen par question (en secondes) */
   averageTimePerQuestion: number;
 }
 
 /* =========================
    (EXTENSION READY)
    ========================= */
 /*
   Ce fichier est volontairement :
   - stable
   - lisible
   - non verbeux
 
   Il peut être étendu plus tard avec :
   - IPTScore
   - PatternDetection
   - RiskFlags
   - RecommendationBlocks
   sans casser le frontend existant.
 */
 