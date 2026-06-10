import Link from "next/link";
import { BookOpen, Gauge, Route } from "lucide-react";

const docs = [
  {
    href: "/coach/documentation/transformation-score",
    title: "Score de transformation",
    description:
      "Comprendre le score global du client, les 4 dimensions utilisées, les poids par objectif et la bonne manière de l’interpréter.",
    icon: Gauge,
  },
  {
    href: "/coach/documentation/phase-optimization",
    title: "Optimisation de phase",
    description:
      "Comprendre le verdict de phase, les signaux analysés, la logique du moteur et la façon de l’utiliser pour guider une décision coach.",
    icon: Route,
  },
];

export default function CoachDocumentationIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
        <div className="mb-8 rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(31,138,101,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            <BookOpen size={12} />
            <span>Documentation coach</span>
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white">
            Comprendre les outils d’aide à la décision
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62">
            Cette documentation explique, en langage naturel, le rôle de chaque outil, les données utilisées, la façon correcte de lire les résultats et comment améliorer la qualité des signaux pour obtenir des décisions plus fiables.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {docs.map((doc) => {
            const Icon = doc.icon;
            return (
              <Link
                key={doc.href}
                href={doc.href}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]"
              >
                <div className="mb-3 inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-white/72">
                  <Icon size={18} />
                </div>
                <h2 className="text-lg font-semibold text-white/86">{doc.title}</h2>
                <p className="mt-2 text-sm leading-7 text-white/58">
                  {doc.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
