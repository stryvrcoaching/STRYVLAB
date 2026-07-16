import { DocsArticle, DocsCard, DocsSection } from '@/components/docs/DocsArticle'
import { requireCoachDocsAccess } from '@/lib/docs/server'

export default async function CoachConnectedEcosystemDocumentationPage() {
  await requireCoachDocsAccess()

  return (
    <DocsArticle
      eyebrow="Écosystème STRYVR"
      title="Flux de données et impacts bidirectionnels"
      intro="Cette documentation explique comment le Coach Dashboard et l'application PWA du client interagissent. Comprendre ces boucles de données permet d'optimiser vos décisions et d'anticiper l'impact de chaque modification en direct."
      backHref="/coach/documentation"
      backLabel="Documentation coach"
    >
      <DocsSection title="Le principe de l'écosystème connecté">
        <p>
          STRYVR ne fonctionne pas comme un tableur ou un PDF figé. Le Coach Dashboard et l'application PWA du client sont deux fenêtres ouvertes sur une seule et même base de données physiologiques en temps réel.
        </p>
        <p>
          Chaque action que vous effectuez en tant que coach modifie l'expérience et l'affichage du client. Inversement, chaque log (pesée, repas, séance) saisi par le client recalcule instantanément vos tableaux de bord et nourrit les moteurs d'aide à la décision (TDEE adaptatif, surcharge progressive, récupération).
        </p>
      </DocsSection>

      <DocsSection title="1. La boucle de la nutrition">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Impact du Coach vers le Client">
            <p>
              • <strong>Action</strong> : Vous modifiez et partagez un nouveau protocole nutritionnel (calories, macros, Carb Cycling) ou vous appliquez un lissage calorique.<br />
              • <strong>Effet Client</strong> : Les cibles de la journée et le plan de repas (*Meal Plan*) se mettent à jour instantanément sur l'application du client. S'il y a un plan alimentaire précis, les grammes de ses ingrédients sont recalculés en direct pour s'adapter à la nouvelle cible.
            </p>
          </DocsCard>
          <DocsCard title="Impact du Client vers le Coach">
            <p>
              • <strong>Action</strong> : Le client valide ses repas (via la saisie manuelle ou le log vocal intelligent) et enregistre son poids.<br />
              • <strong>Effet Coach</strong> : Les apports réels s'affichent sur votre tableau de bord. Le système calcule le **Score de Cohérence** et alimente le **TDEE adaptatif**. Si le client logue mal ou peu, le système vous alerte en passant en mode « Proxy » (formule théorique faute de données réelles suffisantes).
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="2. La boucle de l'entraînement et de la surcharge">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Impact du Coach vers le Client">
            <p>
              • <strong>Action</strong> : Vous créez ou modifiez le programme d'entraînement (exercices, séries, reps cibles, charge conseillée, RIR et tempo).<br />
              • <strong>Effet Client</strong> : Lorsque le client lance son player d'entraînement à la salle, il voit exactement vos consignes, les tempos à respecter et les estimations de charge calculées pour son niveau actuel.
            </p>
          </DocsCard>
          <DocsCard title="Impact du Client vers le Coach">
            <p>
              • <strong>Action</strong> : Le client effectue sa séance, coche ses séries validées, et ajuste les répétitions ou le poids réellement soulevé. Il peut aussi remplacer un exercice par une alternative.<br />
              • <strong>Effet Coach</strong> : Le volume d'entraînement réel est recalculé. Le système met à jour son **1RM estimé** et modifie la charge conseillée pour sa prochaine séance. Si le client a choisi une alternative, vous voyez immédiatement quel exercice a été substitué et pourquoi (douleur, matériel indisponible).
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="3. La boucle CycleSync (Physiologie Féminine)">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Impact du Client vers le Coach">
            <p>
              • <strong>Action</strong> : La cliente renseigne le premier jour de ses menstruations sur son application.<br />
              • <strong>Effet Coach</strong> : Son calendrier hormonal se met à jour dans votre Nutrition Studio. L'algorithme applique automatiquement une **soustraction de 0,8 kg** sur ses pesées en phase lutéale pour neutraliser la rétention d'eau et éviter de fausser le TDEE adaptatif.
            </p>
          </DocsCard>
          <DocsCard title="Impact du Coach vers le Client">
            <p>
              • <strong>Action</strong> : Vous activez l'option CycleSync sur son protocole de nutrition.<br />
              • <strong>Effet Client</strong> : L'application de la cliente va automatiquement augmenter les glucides et moduler les lipides durant sa phase folliculaire (meilleure sensibilité à l'insuline, entraînements intenses) et rééquilibrer en phase lutéale pour stabiliser l'énergie et calmer les fringales sans changer manuellement les repas.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="4. La boucle des Check-ins et de la Récupération">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Impact du Client vers le Coach">
            <p>
              • <strong>Action</strong> : Le client remplit son check-in quotidien au réveil (sommeil, fatigue nerveuse, courbatures, fréquence cardiaque au repos).<br />
              • <strong>Effet Coach</strong> : Ces données alimentent le **Panneau d'Intelligence Client** et le moteur d'**Optimisation de Phase**. Vous recevez des alertes de fatigue dans votre boîte de réception et le système peut vous suggérer d'activer une phase de déchargement (*Deload*).
            </p>
          </DocsCard>
          <DocsCard title="Impact du Coach vers le Client">
            <p>
              • <strong>Action</strong> : Vous décidez d'ajuster la phase de travail (ex: passage en bloc d'accumulation ou en deload thérapeutique).<br />
              • <strong>Effet Client</strong> : L'interface du client s'adapte immédiatement. Ses séances de musculation passent automatiquement en mode deload (volume réduit, intensité adaptée) et ses messages IA d'accueil du matin s'orientent vers des conseils de récupération active.
            </p>
          </DocsCard>
        </div>
      </DocsSection>

      <DocsSection title="Synthèse des impacts en temps réel">
        <p>
          Ce tableau récapitule les connexions clés à garder en tête :
        </p>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <table className="w-full text-left text-xs leading-relaxed text-white/70">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.04]">
                <th className="p-4 font-bold text-white">Action à la source</th>
                <th className="p-4 font-bold text-white">Ce qui est recalculé / impacté</th>
                <th className="p-4 font-bold text-white">Résultat dans l'autre interface</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              <tr>
                <td className="p-4 font-semibold text-white/90">Le coach valide le lissage calorique</td>
                <td className="p-4">Les repas futurs du plan alimentaire sont ajustés par un coefficient correcteur.</td>
                <td className="p-4 text-emerald-400">Le client voit ses quantités d'ingrédients adaptées sur sa PWA.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white/90">Le client oublie de se peser et de logger</td>
                <td className="p-4">Le score de cohérence chute et la confiance du TDEE adaptatif passe à « Basse ».</td>
                <td className="p-4 text-amber-400">Le coach voit un avertissement « Proxy » et ne doit pas recalculer.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white/90">La cliente note son premier jour de règles</td>
                <td className="p-4">La phase du cycle passe en folliculaire, activant le décalage de macros CycleSync.</td>
                <td className="p-4 text-emerald-400">Le coach voit la phase mise à jour sur le graphique métabolique.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white/90">Le client augmente la charge d'un exercice</td>
                <td className="p-4">L'estimation du 1RM de cet exercice est recalculée.</td>
                <td className="p-4 text-emerald-400">Le coach voit la courbe de force monter dans les Performances.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white/90">Le client logue une mauvaise récupération</td>
                <td className="p-4">Le score de récupération s'effondre dans le panneau d'intelligence.</td>
                <td className="p-4 text-amber-400">Le coach reçoit une suggestion d'optimisation de phase (Deload).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsSection title="Conseils pour le coach">
        <div className="grid gap-4 md:grid-cols-2">
          <DocsCard title="Exploiter la synchronisation">
            <p>
              • <strong>Faites confiance aux lissages</strong> : Plutôt que de paniquer face à un repas d'anniversaire ou un écart, utilisez l'outil de lissage calorique. Le client verra ses assiettes s'adapter en douceur les jours suivants sans culpabiliser.<br />
              • <strong>Vérifiez la cohérence d'abord</strong> : Avant de déclarer qu'un métabolisme ralentit, assurez-vous que le score d'adhérence du client est bien au-dessus de 80 %.
            </p>
          </DocsCard>
          <DocsCard title="Communiquer sur le logging">
            <p>
              • <strong>Sensibilisez les clients</strong> : Expliquez-leur que chaque log est une pièce de puzzle. Sans pesée régulière, CycleSync ne peut pas filtrer l'eau correctement, et le TDEE adaptatif ne peut pas calculer leur métabolisme exact.
            </p>
          </DocsCard>
        </div>
      </DocsSection>
    </DocsArticle>
  )
}
