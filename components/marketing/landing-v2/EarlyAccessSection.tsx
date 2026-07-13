import { PrimaryCta, SecondaryCta, SectionHeading } from "./primitives";

export function EarlyAccessSection() {
  return (
    <section
      id="acces"
      className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36"
    >
      <div className="mx-auto grid max-w-[1440px] gap-10 rounded-[28px] border border-white/12 bg-[#121714] p-7 shadow-[0_24px_80px_rgba(0,0,0,.3)] sm:p-10 lg:grid-cols-[.9fr_1.1fr] lg:p-14">
        <SectionHeading
          eyebrow="Accès STRYVLAB"
          title="Construisez votre système de coaching avant d’augmenter votre volume."
        />
        <div className="self-end">
          <p className="max-w-xl text-[17px] leading-8 text-white/62">
            STRYVLAB ouvre progressivement la plateforme à une première cohorte
            de coachs. La démonstration permet de vérifier l’adéquation avec
            votre méthode, votre portefeuille et votre organisation.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryCta eventName="demo_cta">Réserver une démonstration</PrimaryCta>
            <SecondaryCta href="#produit">Voir la plateforme</SecondaryCta>
          </div>
        </div>
      </div>
    </section>
  );
}
