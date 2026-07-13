"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand, PrimaryCta, SecondaryCta } from "./primitives";

const links = [
  ["Produit", "#produit"],
  ["Méthode", "#methode"],
  ["STRYVR", "#stryvr"],
  ["Accès", "#acces"],
] as const;

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 48);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className="absolute inset-x-3 top-3 z-50 lg:fixed lg:inset-x-6 lg:top-5">
      <nav
        aria-label="Navigation principale"
        className={`mx-auto max-w-[1344px] rounded-[18px] px-4 transition-[background,border-color,box-shadow] duration-200 sm:px-5 ${scrolled ? "border border-white/14 bg-[#101312]/84 shadow-[0_18px_50px_rgba(0,0,0,.34)] backdrop-blur-xl" : "border border-transparent bg-transparent"}`}
      >
        <div className="flex h-14 items-center justify-between gap-3">
          <a
            href="#top"
            aria-label="STRYVLAB — retour en haut"
            className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c6b48b]"
          >
            <Brand />
          </a>
          <div className="hidden items-center gap-6 font-barlow-condensed text-[11px] font-medium uppercase tracking-[0.14em] text-white/62 lg:flex">
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded px-1 py-2 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c6b48b]"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <SecondaryCta href="#produit">Voir la plateforme</SecondaryCta>
            <PrimaryCta compact eventName="demo_cta">Réserver une démonstration</PrimaryCta>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <PrimaryCta compact eventName="demo_cta">
              <span className="sm:hidden">Démo</span>
              <span className="hidden sm:inline">Réserver une démo</span>
            </PrimaryCta>
            <button
              type="button"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
              aria-controls="landing-v2-mobile-menu"
              onClick={() => setOpen((current) => !current)}
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 text-white transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6b48b]"
            >
              {open ? (
                <X aria-hidden="true" className="size-5" />
              ) : (
                <Menu aria-hidden="true" className="size-5" />
              )}
            </button>
          </div>
        </div>
        {open && (
          <div
            id="landing-v2-mobile-menu"
            className="border-t border-white/12 pb-4 pt-3 lg:hidden"
          >
            <div className="grid gap-1">
              <a
                href="#top"
                onClick={() => setOpen(false)}
                className="rounded px-3 py-3 font-barlow-condensed text-sm uppercase tracking-[.14em] text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c6b48b]"
              >
                Accueil
              </a>
              {links.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="rounded px-3 py-3 font-barlow-condensed text-sm uppercase tracking-[.14em] text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c6b48b]"
                >
                  {label}
                </a>
              ))}
              <PrimaryCta eventName="demo_cta">Réserver une démonstration</PrimaryCta>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
