export default function FaqOmniSchema() {
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "Qu’est-ce que le protocole OMNI ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "OMNI est un programme d’optimisation continue destiné aux profils avancés. Il ne s’agit pas d’un simple coaching, mais d’un cadre stratégique évolutif basé sur l’analyse du potentiel de transformation (IPT™) et son élévation progressive dans le temps."
                }
              },
              {
                "@type": "Question",
                "name": "OMNI est-il accessible à tout le monde ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Non. OMNI est réservé aux profils éligibles. L’accès est conditionné à une analyse préalable et à un entretien stratégique. Certains profils peuvent être refusés si le niveau de contrainte ou d’inadéquation stratégique est jugé trop élevé."
                }
              },
              {
                "@type": "Question",
                "name": "Pourquoi une analyse IPT™ est-elle obligatoire avant OMNI ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Parce qu’optimiser un système sans connaître son potentiel réel conduit à des erreurs stratégiques. L’IPT™ permet d’identifier les leviers prioritaires, les freins dominants et le niveau de réceptivité du système avant toute intervention avancée."
                }
              },
              {
                "@type": "Question",
                "name": "OMNI est-il un programme médical ou thérapeutique ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Non. OMNI n’est ni un acte médical ni un traitement. Il s’agit d’une analyse fonctionnelle et stratégique du potentiel de transformation. Aucune pathologie n’est diagnostiquée et aucun avis médical n’est remplacé."
                }
              },
              {
                "@type": "Question",
                "name": "Quels types de profils sont adaptés à OMNI ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "OMNI s’adresse aux profils ayant déjà expérimenté des plateaux, des échecs répétés ou des limites malgré des efforts importants. Il est conçu pour les individus recherchant une supervision stratégique, une lecture systémique et une optimisation sur le moyen à long terme."
                }
              },
              {
                "@type": "Question",
                "name": "Le protocole OMNI garantit-il des résultats ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Non. Aucun résultat n’est garanti. OMNI vise à augmenter le potentiel de transformation et à améliorer les conditions d’adhérence et d’efficacité. La transformation dépend toujours de multiples facteurs biologiques, comportementaux et contextuels."
                }
              },
              {
                "@type": "Question",
                "name": "Pourquoi un entretien stratégique est-il requis après le paiement ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "L’entretien stratégique permet de valider l’alignement entre le protocole OMNI et votre situation réelle. Il sert à cadrer les attentes, confirmer l’éligibilité et structurer l’ingénierie du dossier avant toute mise en œuvre."
                }
              },
              {
                "@type": "Question",
                "name": "Que se passe-t-il après l’entretien stratégique OMNI ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Après validation, vous accédez à la phase de pré-analyse IPT™, puis à l’analyse adaptative complète. Le protocole est ensuite construit et ajusté en fonction de l’évolution de votre potentiel et des contraintes observées."
                }
              },
              {
                "@type": "Question",
                "name": "OMNI est-il limité dans le temps ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "OMNI est structuré sur une période initiale de 12 semaines, mais repose sur une logique évolutive. L’objectif n’est pas une transformation rapide, mais une optimisation progressive et durable du système."
                }
              }
            ]
          })
        }}
      />
    );
  }
  