'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, AlertTriangle, ShieldCheck, CreditCard, X, ScrollText, Lock, Server, Ban } from 'lucide-react';

export default function CGVPage() {
  return (
    <main className="min-h-screen bg-background text-primary font-outfit">
      
      {/* HEADER FIXE */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-6 bg-background/80 backdrop-blur-md border-b border-gray-100/50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/" className="group flex items-center gap-2">
            <span className="text-xl font-bold tracking-widest text-primary">STRYV</span>
            <span className="text-xl font-light text-secondary">Smart fit</span>
          </Link>
          <Link 
            href="/" 
            className="w-8 h-8 rounded-full bg-surface shadow-soft-out flex items-center justify-center text-secondary hover:text-primary hover:scale-105 transition-all"
          >
            <X size={16} />
          </Link>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <div className="pt-32 pb-20 px-6 md:px-12">
        <div className="max-w-3xl mx-auto">
          
          {/* TITRE & INTRO */}
          <div className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 border border-accent/10 text-[10px] font-bold tracking-widest text-accent uppercase mb-6">
              <ScrollText size={12} />
              Document Contractuel
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary mb-6">
              Conditions Générales de Vente<br/>
              <span className="text-secondary font-medium text-2xl">Services STRYV lab</span>
            </h1>
            <p className="text-sm text-secondary leading-relaxed font-light">
              Encadrement juridique de la vente en ligne des services numériques d'analyse et de coaching.<br/>
              Dernière mise à jour : 09 janvier 2026
            </p>
          </div>

          {/* GRILLE DES SECTIONS */}
          <div className="grid gap-8">
            
            {/* --- BLOC 1 : DÉFINITIONS & OBJET --- */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <FileText size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">Article 1 - Objet & Définitions</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-4">
                <p>
                  Les présentes Conditions Générales de Vente (CGV) régissent l'ensemble des services numériques commercialisés par <strong>STRYV lab</strong> via son site web et ses applications, notamment :
                </p>
                <ul className="list-disc pl-4 space-y-2 text-gray-600">
                  <li><strong>Analyse IPT™</strong> : Service numérique d'évaluation du potentiel de transformation via questionnaire adaptatif (253 questions), traitement algorithmique et génération de rapport personnalisé.</li>
                  <li><strong>Protocole G+</strong> : Protocole d'optimisation métabolique incluant structure nutritionnelle, timing stratégique et recommandations d'entraînement.</li>
                  <li><strong>Coaching OMNI</strong> : Programme d'accompagnement personnalisé avec cycles, checkpoints et recalibration.</li>
                  <li><strong>Outils de calcul</strong> : Calculateurs gratuits (Body Fat, 1RM, macros) accessibles sans paiement.</li>
                </ul>
                <p className="pt-2">
                  <strong>Finalité des services payants :</strong> Évaluation du potentiel de transformation, identification des contraintes métaboliques et comportementales, priorisation des leviers d'optimisation (nutrition, sommeil, entraînement, stress, récupération, adhérence).
                </p>
                <p className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <strong>Note :</strong> Le périmètre exact de chaque service (contenu, durée, livrables) est celui décrit sur la page de vente au moment du paiement. Les services évoluent régulièrement ; la version contractuelle est celle acceptée lors de la transaction.
                </p>
              </div>
            </section>

            {/* --- BLOC 2 : ACCÈS & VERROUILLAGE --- */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Lock size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">Article 2 - Conditions d'Accès</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  L'accès aux services payants (Analyse IPT™, Protocole G+, Coaching OMNI) est <strong>strictement verrouillé</strong> et conditionné à la validation cumulative de :
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li>La confirmation du paiement par le processeur Stripe.</li>
                  <li>La validation technique de la session utilisateur (cookie sécurisé, token ou session ID).</li>
                </ul>
                <p className="pt-2">
                  Toute tentative d'accès non autorisé (URL forcée, cookie modifié, session expirée) sera automatiquement bloquée par le middleware de sécurité et redirigée vers la page de paiement.
                </p>
                <p>
                  <strong>Outils gratuits :</strong> Les calculateurs accessibles gratuitement ne nécessitent aucun paiement ni création de compte.
                </p>
              </div>
            </section>

            {/* --- BLOC 3 : PRIX & PAIEMENT --- */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <CreditCard size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">Article 3 - Prix & Paiement</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  Les prix sont affichés en <strong>Euros (€) TTC</strong>. Le tarif applicable est celui indiqué sur la page de vente au moment de la validation du paiement.
                </p>
                <p>
                  <strong>Grille tarifaire indicative (susceptible d'évolution) :</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li>Analyse IPT™ : 35€</li>
                  <li>Protocole G+ : 250€</li>
                  <li>Coaching OMNI : 800€</li>
                </ul>
                <p className="pt-2">
                  Le paiement est exigible <strong>immédiatement</strong> et traité de manière sécurisée par <strong>Stripe</strong> (PCI-DSS Level 1). Les moyens de paiement acceptés sont : carte bancaire (Visa, Mastercard), Apple Pay, Google Pay.
                </p>
                <p>
                  En cas de refus de paiement (carte invalide, fonds insuffisants), l'accès au service sera refusé jusqu'à régularisation.
                </p>
              </div>
            </section>

            {/* --- BLOC 4 : RÉTRACTATION & REMBOURSEMENT --- */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8 border-l-4 border-l-red-400">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-red-50 rounded-lg text-red-600">
                  <Ban size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">Article 4 - Rétractation & Remboursement</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-4">
                <p>
                  <strong>Droit de rétractation (Exception légale) :</strong>
                </p>
                <p>
                  Conformément à l'article L221-28 du Code de la consommation (ou équivalent européen), le droit de rétractation de 14 jours ne s'applique <strong>pas</strong> aux contenus numériques lorsque :
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li>Le consommateur a expressément demandé l'exécution immédiate du service.</li>
                  <li>Le consommateur a reconnu perdre son droit de rétractation dès le début de l'exécution.</li>
                  <li>Le service a été pleinement exécuté (questionnaire complété, rapport généré, accès déverrouillé).</li>
                </ul>
                <p className="pt-3">
                  <strong>Politique de remboursement :</strong>
                </p>
                <ul className="list-disc pl-4 space-y-2 text-gray-600">
                  <li><strong>Service exécuté :</strong> Si le client a accédé au questionnaire, complété l'analyse et reçu son rapport IPT™, aucun remboursement n'est possible (service intégralement délivré).</li>
                  <li><strong>Incident technique bloquant :</strong> Si un bug technique empêche l'accès ou la génération du rapport malgré le paiement validé, STRYV lab s'engage à corriger l'incident sous 48h ouvrées. Si la correction est impossible, un remboursement intégral ou un avoir sera proposé.</li>
                  <li><strong>Paiement sans exécution :</strong> Si le paiement a été débité mais que l'accès n'a jamais été déverrouillé (erreur système), un remboursement automatique sera initié sous 7 jours.</li>
                </ul>
                <p className="text-xs bg-red-50 p-3 rounded-lg border border-red-100 mt-4">
                  <strong>Important :</strong> L'insatisfaction quant aux résultats de l'analyse (score IPT faible, contraintes détectées, recommandations non attendues) ne constitue pas un motif de remboursement. L'analyse reflète l'état objectif du système métabolique et comportemental basé sur les réponses fournies.
                </p>
              </div>
            </section>

            {/* --- BLOC 5 : AVERTISSEMENT MÉDICAL --- */}
            <section className="bg-yellow-50/30 border border-yellow-200 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-yellow-100 rounded-lg text-yellow-700">
                  <AlertTriangle size={20} />
                </div>
                <h2 className="text-lg font-bold text-yellow-900 pt-1">Article 5 - Avertissement Médical</h2>
              </div>
              <div className="text-sm text-yellow-900/80 leading-relaxed pl-12 space-y-3">
                <p className="font-bold text-yellow-900">
                  ⚠️ MISE EN GARDE IMPÉRATIVE
                </p>
                <p>
                  Les services STRYV lab (Analyse IPT™, Protocole G+, Coaching OMNI) <strong>ne sont pas des dispositifs médicaux</strong> et <strong>ne posent aucun diagnostic médical</strong>. Ils ne remplacent en aucun cas une consultation avec un professionnel de santé qualifié (médecin, nutritionniste, psychologue).
                </p>
                <p>
                  <strong>Cas nécessitant un avis médical préalable obligatoire :</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Pathologies chroniques (diabète, hypertension, troubles cardiovasculaires, troubles hormonaux).</li>
                  <li>Troubles du comportement alimentaire (TCA) avérés ou suspectés (anorexie, boulimie, orthorexie).</li>
                  <li>Grossesse, allaitement ou post-partum.</li>
                  <li>Traitement médicamenteux en cours pouvant interagir avec l'alimentation ou l'exercice.</li>
                  <li>Symptômes médicaux non expliqués (fatigue chronique sévère, douleurs, troubles digestifs).</li>
                </ul>
                <p className="pt-3">
                  <strong>Absence de garantie de résultat :</strong>
                </p>
                <p>
                  STRYV lab ne garantit <strong>aucun résultat spécifique</strong> (perte de poids, gain musculaire, amélioration des performances, réduction du stress). Les résultats dépendent de facteurs individuels non contrôlables par STRYV lab : génétique, historique médical, adhérence réelle au protocole, contexte psychosocial, qualité du sommeil, niveau de stress.
                </p>
                <p className="text-xs bg-yellow-100 p-3 rounded-lg border border-yellow-200 mt-4">
                  En utilisant les services STRYV lab, vous reconnaissez avoir lu cet avertissement et acceptez la responsabilité de consulter un professionnel de santé si nécessaire.
                </p>
              </div>
            </section>

            {/* --- BLOC 6 : RESPONSABILITÉ CLIENT & DONNÉES --- */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <ShieldCheck size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">Article 6 - Obligations du Client & Données</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-4">
                <p>
                  <strong>Obligations du Client :</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li>Fournir des informations <strong>exactes et complètes</strong> lors du questionnaire. Toute réponse intentionnellement faussée compromet la validité de l'analyse.</li>
                  <li>Ne pas tenter de contourner les protections techniques (modification de cookies, injection de code, accès par URL forcée).</li>
                  <li>Respecter les recommandations dans les limites de sa condition physique et médicale.</li>
                  <li>Ne pas revendre, partager publiquement ou reproduire les contenus propriétaires (rapports, protocoles, recommandations).</li>
                </ul>
                
                <p className="pt-4">
                  <strong>Données Personnelles (RGPD) :</strong>
                </p>
                <p>
                  Les données collectées (réponses au questionnaire, coordonnées de paiement, adresse e-mail) sont utilisées exclusivement pour :
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li>L'exécution du service contractuel (génération du rapport, accès sécurisé).</li>
                  <li>L'amélioration du scoring algorithmique via statistiques <strong>anonymisées et agrégées</strong> (aucune donnée personnelle identifiable n'est conservée dans les datasets d'entraînement).</li>
                  <li>La gestion de la relation client (support technique, facturation).</li>
                </ul>
                <p>
                  Les données de paiement sont traitées par Stripe (PCI-DSS) et ne transitent jamais par les serveurs STRYV lab.
                </p>
                <p>
                  <strong>Droits RGPD :</strong> Vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Contact : [EMAIL À COMPLÉTER].
                </p>
                <p>
                  <strong>Conservation :</strong> Les données sont conservées 3 ans après la dernière interaction, puis supprimées. Les statistiques anonymisées n'ont pas de limite de conservation.
                </p>
              </div>
            </section>

            {/* --- BLOC 7 : PROPRIÉTÉ INTELLECTUELLE --- */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <FileText size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">Article 7 - Propriété Intellectuelle</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  L'ensemble des éléments composant les services STRYV lab (marques, logos, algorithmes, questionnaires, rapports, protocoles, design, code source) sont la propriété exclusive de STRYV lab et protégés par le droit d'auteur, le droit des marques et le droit des bases de données.
                </p>
                <p>
                  <strong>Licence d'utilisation :</strong> Le client bénéficie d'une licence <strong>personnelle, non exclusive, non transférable</strong> pour utiliser les résultats de son analyse à des fins strictement personnelles.
                </p>
                <p>
                  <strong>Interdictions :</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li>Reproduction, diffusion publique ou commercialisation des rapports.</li>
                  <li>Rétro-ingénierie des algorithmes (scraping, extraction de la logique de scoring).</li>
                  <li>Utilisation des marques "STRYV lab" et "IPT" sans autorisation écrite.</li>
                </ul>
              </div>
            </section>

            {/* --- BLOC 8 : DISPONIBILITÉ & LITIGES --- */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Server size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">Article 8 - Disponibilité & Litiges</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  <strong>Disponibilité du service :</strong> STRYV lab s'efforce de maintenir une disponibilité de 99% du service. Des interruptions planifiées pour maintenance peuvent survenir (notification préalable par e-mail si possible).
                </p>
                <p>
                  Aucune indemnité n'est due pour une indisponibilité raisonnable n'excédant pas 48h consécutives.
                </p>
                <p className="pt-3">
                  <strong>Force Majeure :</strong> STRYV lab ne saurait être tenu responsable en cas d'impossibilité d'exécution due à :
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li>Panne réseau ou défaillance de l'hébergeur (Vercel, Supabase).</li>
                  <li>Défaillance du processeur de paiement (Stripe).</li>
                  <li>Attaque informatique (DDoS, piratage).</li>
                  <li>Cas de force majeure (catastrophe naturelle, conflit, épidémie, décision gouvernementale).</li>
                </ul>
                
                <p className="pt-4">
                  <strong>Droit applicable :</strong> Droit belge (siège social à Bruxelles).
                </p>
                <p>
                  <strong>Résolution des litiges :</strong> En cas de différend, nous privilégions la recherche d'une solution amiable. Le client peut contacter le support à contact@stryvlab.com avec l'objet "Litige - [Référence commande]".
                </p>
                <p>
                  À défaut de solution amiable sous 30 jours, compétence exclusive est attribuée aux tribunaux de Bruxelles.
                </p>
                <p className="pt-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <strong>Contact Support :</strong> contact@stryvlab.com — Objet : « Service » ou « Analyse IPT™ »<br/>
                  Délai de réponse : 48h ouvrées maximum.
                </p>
              </div>
            </section>

            {/* --- BLOC 9 : ÉVOLUTION DES CGV --- */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <ScrollText size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">Article 9 - Modification des CGV</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  STRYV lab se réserve le droit de modifier les présentes CGV à tout moment. Les modifications entrent en vigueur dès leur mise en ligne.
                </p>
                <p>
                  Les transactions en cours restent régies par les CGV acceptées au moment du paiement. Les clients réguliers (abonnements, coaching OMNI) seront notifiés par e-mail des modifications substantielles.
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-200 py-12 px-6 text-center">
        <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">
          © {new Date().getFullYear()} STRYV lab.
        </p>
      </footer>
    </main>
  );
}