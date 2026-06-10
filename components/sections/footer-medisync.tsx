'use client'

import Link from 'next/link'

export function FooterMedisync() {
  return (
    <footer className="relative overflow-hidden">
      {/* Image de fond floutée */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/IMAGE/GEN25.jpg)',
            filter: 'blur(15px)',
            transform: 'scale(1.1)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(25,212,255,0.3)] via-[rgba(15,35,52,0.4)] to-[rgba(15,35,52,0.5)]" />
      </div>

      {/* Glassmorphic Footer */}
      <div className="relative z-20">
        {/* Footer content */}
        <div className="bg-white/10 backdrop-blur-3xl border-t border-[rgba(255,255,255,0.25)]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
            <div className="grid md:grid-cols-3 gap-12">
              {/* Brand Identity Column */}
              <div className="space-y-6 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-light text-white">STRYV lab</span>
                </div>
                <p className="text-white/70 text-sm leading-relaxed font-light">
                  Coaching métabolique forensique basé sur l'analyse scientifique de votre biologie unique.
                </p>
                
                {/* Fine blue line */}
                <div className="w-full h-px bg-[#19D4FF] rounded-full"></div>
                
                {/* Legal links */}
                <div className="flex flex-col gap-2 pt-4">
                  <Link href="#" className="text-white/50 hover:text-white/70 text-xs font-light transition-colors">
                    Conditions d'utilisation
                  </Link>
                  <Link href="#" className="text-white/50 hover:text-white/70 text-xs font-light transition-colors">
                    Politique de confidentialité
                  </Link>
                </div>
              </div>

              {/* Navigation Columns */}
              <div>
                <h4 className="text-white font-normal mb-4 text-base">Plateforme</h4>
                <ul className="space-y-2">
                  {['Formules', 'Pourquoi STRYV lab', 'Comment ça marche', 'FAQ'].map((item) => (
                    <li key={item}>
                      <Link href="#" className="text-white/70 hover:text-white text-sm font-light transition-colors">
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-white font-normal mb-4 text-base">Entreprise</h4>
                <ul className="space-y-2">
                  {['À propos', 'Carrières', 'Contact'].map((item) => (
                    <li key={item}>
                      <Link href="#" className="text-white/70 hover:text-white text-sm font-light transition-colors">
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="mt-12 pt-8 border-t border-[rgba(255,255,255,0.25)] flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-white/50 text-xs font-light">
                ©2025 STRYV lab. Tous droits réservés.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}





