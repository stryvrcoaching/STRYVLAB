import { SectionHeading } from "./primitives";

const sources = [
  "Programme",
  "Nutrition",
  "Messages",
  "Performances",
  "Check-ins",
];

export function FragmentationSection() {
  return (
    <section
      id="methode"
      className="scroll-mt-24 border-y border-white/10 bg-[#101312] px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36"
    >
      <div className="mx-auto grid max-w-[1440px] gap-14 lg:grid-cols-[.82fr_1.18fr] lg:gap-24">
        <SectionHeading
          eyebrow="Le problème réel"
          title={
            <>
              Le problème n’est pas le manque de données.{" "}
              <span className="text-white/38">C’est leur fragmentation.</span>
            </>
          }
        >
          Le programme est dans un outil. La nutrition dans un autre. Le vécu du
          coaché dans les messages. Les progrès dans plusieurs tableaux. Avant
          chaque ajustement, le coach doit reconstruire lui-même le contexte.
        </SectionHeading>
        <div className="relative min-h-[360px] overflow-hidden border-y border-white/10 py-6 sm:min-h-[400px]">
          <p className="font-barlow-condensed text-[10px] uppercase tracking-[.16em] text-white/40">
            Environnement fragmenté
          </p>
          <div className="relative mt-8 min-h-[270px]">
            <div
              aria-hidden
              className="absolute left-[15%] top-[12%] h-[68%] border-l border-dashed border-white/18"
            />
            <div
              aria-hidden
              className="absolute left-[15%] right-[18%] top-[48%] border-t border-dashed border-white/18"
            />
            {sources.map((source, index) => (
              <div
                key={source}
                className={`absolute rounded-full border border-white/14 bg-[#0b0c0c] px-4 py-2 font-barlow-condensed text-[11px] uppercase tracking-[.13em] text-white/62 ${["left-[3%] top-[6%]", "left-[30%] top-[2%]", "right-[2%] top-[22%]", "left-[28%] bottom-[6%]", "right-[22%] bottom-[10%]"][index]}`}
              >
                {source}
              </div>
            ))}
            <div className="absolute left-[12%] top-[43%] rounded-[18px] border border-[#c6b48b]/40 bg-[#171713] px-4 py-3 shadow-xl">
              <p className="font-barlow-condensed text-[9px] uppercase tracking-[.15em] text-[#c6b48b]">
                Reconstruction manuelle
              </p>
              <p className="mt-1 text-xs text-white/62">
                Le coach doit reconnecter le contexte.
              </p>
            </div>
            <div className="absolute bottom-0 right-0 rounded-[20px] border border-[#86aeb8]/38 bg-[#111816] px-5 py-4">
              <p className="font-barlow-condensed text-[10px] uppercase tracking-[.15em] text-[#86aeb8]">
                STRYVLAB
              </p>
              <p className="mt-1 text-sm text-white/74">
                Une structure commune pour la décision.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
