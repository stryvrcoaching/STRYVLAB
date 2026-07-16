import { DocsArticle, DocsCard, DocsSection } from '@/components/docs/DocsArticle'
import { requireCoachDocsAccess } from '@/lib/docs/server'

export default async function CoachTdeeWaterfallDocumentationPage() {
  await requireCoachDocsAccess()

  return (
    <DocsArticle
      eyebrow="Nutrition Studio"
      title="Cascade TDEE — Anatomie de la dépense énergétique"
      intro="Cette documentation détaille la cascade TDEE (BMR, NEAT, EAT, TEF), la façon dont le système calcule ces composants et comment personnaliser les paramètres physiques pour affiner les cibles."
      backHref="/coach/documentation"
      backLabel="Documentation coach"
    >
      <DocsSection title="Qu'est-ce que la Cascade TDEE">
        <p>
          Le TDEE (Total Daily Energy Expenditure) représente la dépense calorique totale de votre client sur 24 heures. Dans le Nutrition Studio, cette valeur est décomposée sous forme de cascade visuelle pour que vous puissiez comprendre précisément chaque source de dépense et faire des réglages ciblés.
        </p>
        <p>
          La cascade part du métabolisme de base et y ajoute l'activité passive, l'entraînement et le coût de la digestion avant d'appliquer l'ajustement lié à l'objectif (déficit ou surplus).
        </p>
      </DocsSection>

      <DocsSection title="Les 4 composantes de la dépense globale">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="1. BMR (Métabolisme de Base)">
            <p>
              C'est l'énergie minimale requise pour maintenir l'organisme en vie au repos (organes, cerveau, respiration). Le système le calcule via la formule de Katch-McArdle (si la masse sèche est connue) ou Harris-Benedict. Le coach peut également saisir une valeur mesurée par impédancemétrie.
            </p>
          </DocsCard>
          <DocsCard title="2. NEAT (Thermogénèse hors effort)">
            <p>
              Il s'agit de la dépense liée aux mouvements du quotidien : marcher, se tenir debout, faire le ménage. Dans STRYV, elle est estimée de façon dynamique en fonction du nombre moyen de pas par jour enregistrés par le client.
            </p>
          </DocsCard>
          <DocsCard title="3. EAT (Thermogénèse sportive)">
            <p>
              C'est l'énergie brûlée durant les séances de sport volontaires. Le Nutrition Studio sépare l'EAT musculaire (musculation, calculé selon la fréquence hebdomadaire) et l'EAT cardio (séances de cardio enregistrées avec leur intensité).
            </p>
          </DocsCard>
          <DocsCard title="4. TEF (Effet thermique des aliments)">
            <p>
              Digérer demande de l'énergie. Le TEF représente cette dépense et dépend directement du ratio de macronutriments prescrit. Les protéines demandent beaucoup plus d'énergie pour être assimilées (jusqu'à 20-30 % de leur valeur énergétique) que les glucides ou les lipides.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Comment la cible finale de calories est calculée">
        <p>
          Le Nutrition Studio calcule la cible finale de calories pour le protocole en suivant la formule suivante :
        </p>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 text-sm leading-7 text-white/68">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/72">{`TDEE Théorique = BMR + NEAT + EAT (Musculation) + EAT (Cardio) + TEF
TDEE Ajusté = TDEE Théorique + Facteurs externes (ex: phase lutéale ou alcool)

Cible Calories = TDEE Ajusté x (1 + Pourcentage d'Ajustement)

Où le pourcentage d'ajustement est :
  • Négatif pour une sèche (ex: -15 % à -20 % de déficit)
  • Neutre pour de la maintenance (0 %)
  • Positif pour une prise de muscle (ex: +5 % à +10 % de surplus)`}
          </pre>
        </div>
      </DocsSection>

      <DocsSection title="Personnalisation des paramètres par le coach">
        <p>
          Pour adapter au mieux la cascade aux particularités de votre client, vous disposez de plusieurs curseurs de personnalisation dans le Nutrition Studio :
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Intensité & Fréquence Musculaire">
            <p>
              Ajustez le niveau d'intensité de l'entraînement musculaire. Plus l'intensité ou la fréquence des séances hebdomadaires augmente, plus la part d'EAT musculaire s'élève dans la cascade.
            </p>
          </DocsCard>
          <DocsCard title="Saisie directe du BMR">
            <p>
              Si votre client a effectué un test de calorimétrie ou d'impédancemétrie médicale fiable, vous pouvez désactiver l'estimation théorique et saisir directement la valeur du BMR mesuré.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Bonnes pratiques coach">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Ce qu'il faut faire">
            <p>
              • Ajuster la part d'activité spontanée (NEAT) si votre client a un travail physique (ex : coach sur le plateau, serveur, artisan) même si son tracker affiche un nombre de pas modéré.<br />
              • Renseigner la composition corporelle (masse sèche) dès que possible pour utiliser la formule de Katch-McArdle, beaucoup plus précise chez les sportifs.<br />
              • Adapter l'ajustement calorique (déficit/surplus) selon la tolérance et la psychologie du client.
            </p>
          </DocsCard>
          <DocsCard title="Ce qu'il faut éviter">
            <p>
              • Surévaluer systématiquement le niveau d'activité physique globale pour ne pas créer un surplus calorique involontaire.<br />
              • Saisir une fréquence d'entraînement théorique irréaliste.<br />
              • Oublier de réajuster la cascade si le poids ou l'activité du client a significativement changé au cours des derniers mois.
            </p>
          </DocsCard>
        </div>
      </DocsSection>
    </DocsArticle>
  )
}
