'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, Eye, Server, X, Database, Lock, UserCheck, Clock, Globe } from 'lucide-react';

export default function ConfidentialitePage() {
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
              <Shield size={12} />
              RGPD Compliant
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary mb-6">
              Politique de Confidentialité<br/>
              <span className="text-secondary font-medium text-2xl">STRYV lab</span>
            </h1>
            <p className="text-sm text-secondary leading-relaxed font-light">
              Protection et traitement des données personnelles conformément au RGPD (Règlement Général sur la Protection des Données).<br/>
              Dernière mise à jour : 09 janvier 2026
            </p>
          </div>

          <div className="grid gap-8">

            {/* 1. RESPONSABLE DU TRAITEMENT */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <UserCheck size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">1. Responsable du Traitement</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  <strong>Entité :</strong> STRYV lab<br/>
                  <strong>Siège social :</strong> Mons, Belgique<br/>
                  <strong>Contact DPO/Support :</strong> contact@stryvlab.com
                </p>
                <p>
                  STRYV lab est responsable de la collecte, du traitement et de la sécurisation des données personnelles dans le cadre de ses services (Analyse IPT™, Protocole G+, Coaching OMNI, outils gratuits).
                </p>
              </div>
            </section>

            {/* 2. DONNÉES COLLECTÉES */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Database size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">2. Données Collectées</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-4">
                <p>
                  Dans le cadre de l'utilisation de nos services, nous collectons les catégories de données suivantes :
                </p>
                
                <div>
                  <p className="font-semibold text-primary mb-2">A. Données d'identification</p>
                  <ul className="list-disc pl-4 space-y-1 text-gray-600">
                    <li>Adresse e-mail (obligatoire pour les services payants)</li>
                    <li>Nom/Prénom (optionnel, selon le service)</li>
                    <li>Session ID technique (cookie sécurisé)</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-primary mb-2">B. Données de questionnaire (Analyse IPT™)</p>
                  <ul className="list-disc pl-4 space-y-1 text-gray-600">
                    <li>Profil initial : âge, sexe, poids, taille, objectifs</li>
                    <li>Données métaboliques : énergie post-repas, digestion, faim, fringales</li>
                    <li>Données de stress : axe HPA, cortisol perçu, qualité de sommeil</li>
                    <li>Données d'entraînement : fréquence, intensité, récupération</li>
                    <li>Données comportementales : adhérence, friction, historique de programmes</li>
                    <li>Environnement : contraintes horaires, accès matériel, soutien social</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-primary mb-2">C. Données de paiement</p>
                  <ul className="list-disc pl-4 space-y-1 text-gray-600">
                    <li>Informations bancaires (traitées exclusivement par Stripe, jamais stockées par STRYV lab)</li>
                    <li>Montant et date de transaction</li>
                    <li>Référence de commande</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-primary mb-2">D. Données techniques</p>
                  <ul className="list-disc pl-4 space-y-1 text-gray-600">
                    <li>Adresse IP (pour sécurité et prévention de fraude)</li>
                    <li>Type de navigateur et appareil</li>
                    <li>Horodatage des interactions (début/fin questionnaire, temps de réponse)</li>
                    <li>Cookies techniques (session, préférences)</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 3. FINALITÉS DU TRAITEMENT */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Server size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">3. Finalités du Traitement</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  Vos données sont traitées exclusivement pour les finalités suivantes, avec des bases légales conformes au RGPD :
                </p>
                
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-primary">A. Exécution du contrat (base légale : Art. 6.1.b RGPD)</p>
                    <ul className="list-disc pl-4 space-y-1 text-gray-600 mt-1">
                      <li>Calcul des scores IPT (6 axes + global)</li>
                      <li>Détection des patterns et contraintes métaboliques</li>
                      <li>Génération du rapport personnalisé</li>
                      <li>Déverrouillage de l'accès sécurisé après paiement</li>
                      <li>Fourniture du Protocole G+ ou Coaching OMNI (selon service)</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">B. Intérêt légitime (base légale : Art. 6.1.f RGPD)</p>
                    <ul className="list-disc pl-4 space-y-1 text-gray-600 mt-1">
                      <li>Amélioration du scoring algorithmique via statistiques <strong>anonymisées et agrégées</strong></li>
                      <li>Détection de bugs techniques (logs anonymisés)</li>
                      <li>Prévention de la fraude (détection de paiements suspects)</li>
                      <li>Analytics d'usage (taux de complétion, temps moyen) pour optimisation UX</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">C. Obligation légale (base légale : Art. 6.1.c RGPD)</p>
                    <ul className="list-disc pl-4 space-y-1 text-gray-600 mt-1">
                      <li>Conservation des factures (obligation comptable)</li>
                      <li>Réponse aux réquisitions judiciaires</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">D. Consentement (base légale : Art. 6.1.a RGPD)</p>
                    <ul className="list-disc pl-4 space-y-1 text-gray-600 mt-1">
                      <li>Communication marketing (newsletter, nouveaux services) — <em>optionnel, opt-in explicite</em></li>
                    </ul>
                  </div>
                </div>

                <p className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-100 mt-4">
                  <strong>Important :</strong> Les données de questionnaire sont anonymisées avant agrégation statistique. Aucune donnée personnelle identifiable n'est conservée dans les datasets d'entraînement algorithmique.
                </p>
              </div>
            </section>

            {/* 4. DESTINATAIRES DES DONNÉES */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Globe size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">4. Destinataires des Données</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  Vos données personnelles sont accessibles uniquement à :
                </p>
                <ul className="list-disc pl-4 space-y-2 text-gray-600">
                  <li><strong>Personnel autorisé de STRYV lab</strong> (accès strictement limité au support technique et à l'analyse qualité)</li>
                  <li><strong>Sous-traitants techniques (RGPD-compliant) :</strong>
                    <ul className="list-circle pl-6 mt-1 space-y-1 text-sm">
                      <li><strong>Vercel</strong> (hébergement web, serveurs EU)</li>
                      <li><strong>Supabase</strong> (base de données PostgreSQL, serveurs EU)</li>
                      <li><strong>Stripe</strong> (processeur de paiement PCI-DSS Level 1, ne partage aucune donnée bancaire avec STRYV lab)</li>
                    </ul>
                  </li>
                </ul>
                <p className="pt-2 font-semibold text-primary">
                  ❌ Aucune vente ou partage à des tiers commerciaux (brokers de données, annonceurs, réseaux sociaux).
                </p>
                <p className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-100 mt-3">
                  Tous les sous-traitants sont liés par des accords DPA (Data Processing Agreement) conformes au RGPD, garantissant la protection de vos données.
                </p>
              </div>
            </section>

            {/* 5. DURÉE DE CONSERVATION */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Clock size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">5. Durée de Conservation</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <ul className="list-disc pl-4 space-y-2 text-gray-600">
                  <li><strong>Données de compte actif :</strong> Conservées tant que le compte est actif + 3 ans après la dernière interaction.</li>
                  <li><strong>Données de transaction :</strong> 10 ans (obligation légale comptable).</li>
                  <li><strong>Données de questionnaire anonymisées :</strong> Conservation illimitée (impossibilité de ré-identification).</li>
                  <li><strong>Logs techniques :</strong> 12 mois maximum.</li>
                  <li><strong>Cookies :</strong> 13 mois maximum (conformité ePrivacy).</li>
                </ul>
                <p className="pt-2">
                  À l'issue de ces durées, les données sont supprimées de manière sécurisée et irréversible.
                </p>
              </div>
            </section>

            {/* 6. SÉCURITÉ */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Lock size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">6. Mesures de Sécurité</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  STRYV lab met en œuvre des mesures techniques et organisationnelles pour protéger vos données :
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li><strong>Chiffrement :</strong> HTTPS/TLS 1.3 pour toutes les communications, base de données chiffrée au repos (AES-256).</li>
                  <li><strong>Authentification :</strong> Cookies signés httpOnly, sessions sécurisées, middleware de protection d'accès.</li>
                  <li><strong>Contrôle d'accès :</strong> Principe du moindre privilège, accès limité au personnel autorisé.</li>
                  <li><strong>Backups :</strong> Sauvegardes quotidiennes chiffrées avec rétention 30 jours.</li>
                  <li><strong>Monitoring :</strong> Détection d'intrusion, logs d'accès, alertes automatiques.</li>
                </ul>
                <p className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-100 mt-3">
                  En cas de violation de données (data breach), STRYV lab notifiera les autorités compétentes sous 72h et les personnes concernées si le risque est élevé (conformément à l'Art. 33 et 34 RGPD).
                </p>
              </div>
            </section>

            {/* 7. VOS DROITS RGPD */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8 border-l-4 border-l-accent">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Eye size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">7. Vos Droits (RGPD)</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-4">
                <p>
                  Conformément au RGPD, vous disposez des droits suivants :
                </p>
                
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-primary">Droit d'accès (Art. 15)</p>
                    <p className="text-gray-600">Obtenir une copie de toutes les données personnelles que nous détenons sur vous.</p>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">Droit de rectification (Art. 16)</p>
                    <p className="text-gray-600">Corriger des données inexactes ou incomplètes.</p>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">Droit à l'effacement / "Droit à l'oubli" (Art. 17)</p>
                    <p className="text-gray-600">Demander la suppression de vos données (sous réserve d'obligations légales de conservation, ex: factures).</p>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">⏸Droit à la limitation du traitement (Art. 18)</p>
                    <p className="text-gray-600">Suspendre temporairement le traitement de vos données (ex: pendant vérification d'exactitude).</p>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">Droit à la portabilité (Art. 20)</p>
                    <p className="text-gray-600">Recevoir vos données dans un format structuré, couramment utilisé et lisible par machine (JSON/CSV).</p>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">Droit d'opposition (Art. 21)</p>
                    <p className="text-gray-600">Vous opposer au traitement fondé sur l'intérêt légitime (ex: analytics, marketing).</p>
                  </div>

                  <div>
                    <p className="font-semibold text-primary">Droit de ne pas faire l'objet d'une décision automatisée (Art. 22)</p>
                    <p className="text-gray-600">Le scoring IPT est automatisé mais <strong>non décisionnel</strong> (pas de conséquences juridiques ou significatives). Vous pouvez néanmoins demander une intervention humaine pour révision.</p>
                  </div>
                </div>

                <div className="bg-accent/5 p-4 rounded-lg border border-accent/20 mt-6">
                  <p className="font-semibold text-primary mb-2">Exercice de vos droits</p>
                  <p className="text-gray-700">
                    Pour toute demande, contactez-nous à : <strong>contact@stryvlab.com</strong><br/>
                    Objet : « Demande RGPD - [Droit concerné] »<br/>
                    Délai de réponse : <strong>30 jours maximum</strong> (1 mois RGPD).
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Une vérification d'identité pourra être demandée pour garantir la sécurité de vos données.
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mt-4">
                  <p className="font-semibold text-yellow-900 mb-2">Droit de réclamation</p>
                  <p className="text-yellow-800 text-xs">
                    Si vous estimez que le traitement de vos données ne respecte pas le RGPD, vous avez le droit de déposer une plainte auprès de l'autorité de contrôle compétente :<br/>
                    <strong>Belgique :</strong> Autorité de Protection des Données (APD) — <a href="https://www.autoriteprotectiondonnees.be" className="underline" target="_blank" rel="noopener">www.autoriteprotectiondonnees.be</a>
                  </p>
                </div>
              </div>
            </section>

            {/* 8. COOKIES */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Database size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">8. Cookies</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  STRYV lab utilise des cookies strictement nécessaires au fonctionnement du service :
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                  <li><strong>Cookies de session :</strong> Authentification, verrouillage d'accès, sauvegarde de progression (httpOnly, sécurisés).</li>
                  <li><strong>Cookies de préférences :</strong> Langue, thème (optionnels).</li>
                </ul>
                <p className="pt-2">
                  <strong>Aucun cookie de tracking publicitaire</strong> (Google Analytics, Meta Pixel, etc.) n'est utilisé.
                </p>
                <p className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-100 mt-3">
                  Vous pouvez désactiver les cookies dans votre navigateur, mais cela peut affecter le fonctionnement du service (ex: impossibilité de sauvegarder la progression du questionnaire).
                </p>
              </div>
            </section>

            {/* 9. TRANSFERTS HORS UE */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Globe size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">9. Transferts Internationaux</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  Les données sont hébergées exclusivement dans l'<strong>Union Européenne</strong> (serveurs Vercel/Supabase en Allemagne/Irlande).
                </p>
                <p>
                  Stripe (processeur de paiement) peut transférer des données aux États-Unis, mais dispose de <strong>clauses contractuelles types (CCT)</strong> approuvées par la Commission européenne et est conforme au <strong>EU-US Data Privacy Framework</strong>.
                </p>
              </div>
            </section>

            {/* 10. MODIFICATIONS */}
            <section className="bg-surface border border-white/60 shadow-soft-out rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-surface-light rounded-lg text-accent">
                  <Clock size={20} />
                </div>
                <h2 className="text-lg font-bold text-primary pt-1">10. Modifications de la Politique</h2>
              </div>
              <div className="text-sm text-secondary leading-relaxed pl-12 space-y-3">
                <p>
                  STRYV lab se réserve le droit de modifier cette Politique de Confidentialité pour respecter les évolutions législatives ou améliorer la protection des données.
                </p>
                <p>
                  Les modifications substantielles seront notifiées par e-mail aux utilisateurs actifs. La version en vigueur est toujours accessible sur <strong>stryvlab.com/confidentialite</strong>.
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>

      <footer className="bg-white border-t border-gray-200 py-12 px-6 text-center">
        <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">
          © {new Date().getFullYear()} STRYV lab.
        </p>
      </footer>
    </main>
  );
}