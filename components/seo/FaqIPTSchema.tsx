export default function FaqIPTSchema() {
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
              "name": "L’IPT™ est-il un diagnostic médical ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Non. L’IPT™ n’est pas un diagnostic médical et n’a pas vocation à identifier ou traiter une pathologie. Il s’agit d’un outil d’analyse fonctionnelle permettant d’évaluer la capacité d’un système à s’adapter à une transformation. La méthode repose sur une approche innovante et multidimensionnelle, intégrant des facteurs physiologiques, comportementaux et contextuels, sans se substituer aux cadres médicaux ou cliniques."
              }
            },
      
              {
                "@type": "Question",
                "name": "L’IPT™ garantit-il des résultats ?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Non. L’IPT™ mesure un potentiel, pas une promesse. Cependant, le Rapport IPT identifie vos leviers de progression. Couplé à nos solutions (Protocol G+, OMNI Coaching 3.0), il permet d’augmenter ce potentiel physiologique, maximisant ainsi les probabilités d’une transformation réelle et durable."
                }
    
            },
            {
              "@type": "Question",
              "name": "Pourquoi mesurer le potentiel avant un programme ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Parce que l’efficacité d’un programme dépend de la capacité réelle du système à s’adapter. Lorsque certaines contraintes physiologiques, hormonales ou comportementales sont présentes, l’organisme limite volontairement la transformation. La mesure du potentiel permet d’objectiver ces contraintes avant toute intervention et de poser un cadre décisionnel fondé sur des principes d’adaptation biologique, plutôt que sur une approche uniforme ou standardisée."
              }
            },
            {
              "@type": "Question",
              "name": "À qui s’adresse l’analyse IPT™ ?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "L’analyse IPT™ s’adresse à toute personne souhaitant comprendre les mécanismes qui influencent sa capacité à se transformer. Elle est particulièrement pertinente pour celles et ceux qui rencontrent des stagnations, des échecs répétés ou une difficulté à maintenir des résultats malgré des efforts constants. L’IPT™ est également utilisée en amont d’un accompagnement pour objectiver le potentiel réel du système et orienter les stratégies de transformation de manière plus précise et individualisée."
              }
            }
          ]
        })
      }}
    />
  );
}
