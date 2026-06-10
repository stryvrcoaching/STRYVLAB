'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';

export function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith('/analyse-ipt')) return null;

  return (
    <footer className="py-10 px-6 md:px-12 lg:px-24 border-t border-white/5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Image src="/images/logo.png" alt="STRYV" width={20} height={20} className="w-5 h-5 object-contain opacity-60" />
          <span className="font-unbounded font-semibold text-primary/60 tracking-tight text-xs">
            STRYV<span className="font-light"> lab</span>
          </span>
          <span className="micro text-white/20 mx-1">·</span>
          <span className="micro">© 2025</span>
        </div>
        <p className="micro">
          IPT · Indice de Potentiel de Transformation
        </p>
      </div>
    </footer>
  );
}