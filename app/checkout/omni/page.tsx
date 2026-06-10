'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/checkout/CheckoutForm';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Tag, 
  Loader2, 
  Lock, 
  Smartphone, 
  Check, 
  Zap, 
  Info, 
  AlertCircle, 
  ArrowRight,
  Crown,
  Users,
  MessageCircle,
  Smartphone as AppIcon,
  Activity,
  Brain
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Initialisation Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function OMNICheckoutPage() {
  const router = useRouter();
  
  // --- ÉTATS ---
  const [clientSecret, setClientSecret] = useState("");
  const [amountDisplay, setAmountDisplay] = useState(800.00); // Prix OMNI 12 Semaines
  const [isFree, setIsFree] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [discountInfo, setDiscountInfo] = useState<{ code: string; percent: number; amountSaved: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingPromo, setIsUpdatingPromo] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);

  // --- LOGIQUE BACKEND ---
  const initCheckout = async (code: string = "") => {
    setIsUpdatingPromo(true);
    setErrorMessage("");
    setSuccessMessage("");
    
    try {
      const res = await fetch("/api/checkout/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            productId: 'omni', // Cible OMNI dans le backend
            promoCode: code 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'initialisation");

      setAmountDisplay(data.amount / 100);
      setIsFree(data.isFree);
      setDiscountInfo(data.discount);
      
      if (data.discount) {
        setSuccessMessage(`Code ${data.discount.code} validé (-${data.discount.percent}%)`);
      }

      if (!data.isFree) {
        setClientSecret(data.clientSecret);
      } else {
        setClientSecret("");
      }

    } catch (err: any) {
      setErrorMessage(err.message || "Code invalide");
    } finally {
      setIsLoading(false);
      setIsUpdatingPromo(false);
    }
  };

  useEffect(() => { initCheckout(); }, []);

  const handleApplyPromo = () => { if (promoCode.trim()) initCheckout(promoCode); };
  
  const handleRemovePromo = () => {
    setPromoCode("");
    setDiscountInfo(null);
    initCheckout("");
  };

  const handleSecureFreeAccess = async () => {
    if (!legalAccepted) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/checkout/secure-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          productId: 'omni',
          promoCode: discountInfo?.code,
          legalAccepted: true 
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        // Redirection vers le dossier success existant pour OMNI
        const finalUrl = data.redirectUrl.replace('/checkout/success', '/checkout-success/omni');
        router.push(finalUrl);
      } else {
        setErrorMessage(data.error || "Erreur d'activation");
        setIsLoading(false);
      }
    } catch (e) {
      setErrorMessage("Erreur technique serveur.");
      setIsLoading(false);
    }
  };

  // --- STYLE STRIPE ---
  const appearance = {
    theme: 'flat' as const,
    variables: {
      colorPrimary: '#0F172A',
      colorBackground: '#ffffff',
      colorText: '#0F172A',
      colorDanger: '#ef4444',
      fontFamily: '"Outfit", system-ui, sans-serif',
      fontSizeBase: '14px',
      borderRadius: '12px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': { border: 'none', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)', backgroundColor: '#F8FAFC' },
      '.Input:focus': { boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05), 0 0 0 2px #10B981' },
      '.Label': { fontWeight: '700', color: '#64748B', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }
    }
  };

  return (
    <main className="min-h-screen bg-background text-primary font-outfit flex flex-col">
      
      <div className="flex-grow py-12 px-4 flex items-center justify-center">
        <div className="w-full max-w-5xl grid md:grid-cols-12 gap-8 items-start relative z-10">
          
          {/* === GAUCHE : PRÉSENTATION OMNI (STRIPE DATA) === */}
          <div className="md:col-span-7 space-y-6">
              <Link href="/omni" className="inline-flex items-center gap-2 text-[10px] font-bold text-secondary hover:text-primary transition-colors uppercase tracking-widest mb-4">
                  <ArrowLeft size={10} /> Annuler
              </Link>

              <div className="bg-surface border border-white/60 p-8 rounded-3xl shadow-soft-out relative overflow-hidden h-full">
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-900"></div>
                  
                  <div className="mb-8">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-bold tracking-widest text-slate-900 uppercase mb-4 shadow-sm">
                          <Crown size={12} className="text-amber-500" /> PROGRAMME ÉLITE
                      </div>
                      
                      <h1 className="text-4xl font-bold text-primary mb-6 tracking-tight">
                          OMNI Coaching™ <span className="text-xl text-secondary font-normal block mt-1">(12 Semaines)</span>
                      </h1>
                      
                      <div className="space-y-6">
                        <p className="text-secondary text-sm leading-relaxed">
                            Le programme complet ultime : <span className="font-bold text-primary">IPT™ + Protocole ultra personnalisé + Coaching hebdomadaire + Suivi quotidien + Accès App</span>. Une expérience de transformation assistée et optimisée par vos données biologiques.
                        </p>
                        
                        <div className="bg-surface-light/50 p-6 rounded-2xl border border-gray-100/50">
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-4">L'IMMERSION COMPREND :</p>
                            <ul className="text-sm text-secondary space-y-3">
                                <li className="flex items-start gap-3">
                                    <div className="mt-0.5 w-4 h-4 rounded-full bg-slate-900 flex items-center justify-center text-white flex-shrink-0">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                    <span>Analyse IPT™ & Rapport Stratégique Inclus</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-0.5 w-4 h-4 rounded-full bg-slate-900 flex items-center justify-center text-white flex-shrink-0">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                    <span>Coaching 1-on-1 & Ajustements Hebdomadaires</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-0.5 w-4 h-4 rounded-full bg-slate-900 flex items-center justify-center text-white flex-shrink-0">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                    <span>Support quotidien & Accès complet Genesis App</span>
                                </li>
                            </ul>
                        </div>

                        <p className="text-[10px] text-gray-400 italic leading-relaxed border-l-2 border-gray-200 pl-3">
                            Note : En raison de l'intensité du suivi humain, les places en coaching OMNI sont limitées.
                        </p>
                      </div>
                  </div>

                  {/* GRID 2x2 FONCTIONNALITÉS OMNI */}
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-8 mt-8">
                      <div className="flex gap-3 items-start p-3 rounded-xl hover:bg-surface-light/50 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-surface-light shadow-sm border border-white flex items-center justify-center text-primary flex-shrink-0">
                              <Users size={16} />
                          </div>
                          <div>
                              <h3 className="text-[10px] font-bold text-primary uppercase tracking-wide">Elite Coaching</h3>
                              <p className="text-[10px] text-secondary mt-1 leading-snug">Suivi humain 1-on-1.</p>
                          </div>
                      </div>
                      
                      <div className="flex gap-3 items-start p-3 rounded-xl hover:bg-surface-light/50 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-surface-light shadow-sm border border-white flex items-center justify-center text-primary flex-shrink-0">
                              <Brain size={16} />
                          </div>
                          <div>
                              <h3 className="text-[10px] font-bold text-primary uppercase tracking-wide">Neuro-Logic</h3>
                              <p className="text-[10px] text-secondary mt-1 leading-snug">Adapté à votre profil neuro.</p>
                          </div>
                      </div>

                      <div className="flex gap-3 items-start p-3 rounded-xl hover:bg-surface-light/50 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-surface-light shadow-sm border border-white flex items-center justify-center text-primary flex-shrink-0">
                              <MessageCircle size={16} />
                          </div>
                          <div>
                              <h3 className="text-[10px] font-bold text-primary uppercase tracking-wide">Daily Support</h3>
                              <p className="text-[10px] text-secondary mt-1 leading-snug">Réponse prioritaire 7j/7.</p>
                          </div>
                      </div>

                      <div className="flex gap-3 items-start p-3 rounded-xl hover:bg-surface-light/50 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-surface-light shadow-sm border border-white flex items-center justify-center text-primary flex-shrink-0">
                              <AppIcon size={16} />
                          </div>
                          <div>
                              <h3 className="text-[10px] font-bold text-primary uppercase tracking-wide">App Access</h3>
                              <p className="text-[10px] text-secondary mt-1 leading-snug">Accès premium plateforme.</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* === DROITE : PAIEMENT === */}
          <div className="md:col-span-5">
              <div className="bg-surface p-6 md:p-8 rounded-3xl shadow-soft-out border border-white/60 relative min-h-[500px]">
                  
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                      <h2 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                          <Lock size={12} className="text-slate-900"/> Transaction Sécurisée
                      </h2>
                      <div className="flex gap-2 opacity-40">
                          <Smartphone size={16} />
                      </div>
                  </div>

                  {/* RÉCAP */}
                  <div className="space-y-4 mb-6 bg-surface-light/30 p-5 rounded-2xl border border-gray-100 transition-all">
                      <div className="flex justify-between text-xs font-medium text-secondary">
                          <span>OMNI™ (Accompagnement 12 Sem.)</span>
                          <span className="tabular-nums">800.00€</span>
                      </div>
                      
                      <div className="flex justify-between text-xs font-medium text-emerald-600/70">
                          <span>Analyse IPT™ & Rapport</span>
                          <span className="font-bold">INCLUS</span>
                      </div>

                      {discountInfo && (
                           <div className="flex justify-between text-xs font-bold text-accent animate-in fade-in slide-in-from-left-2 duration-300">
                              <span className="flex items-center gap-1"><Tag size={10}/> Remise ({discountInfo.code})</span>
                              <span className="tabular-nums">-{ (discountInfo.amountSaved / 100).toFixed(2) }€</span>
                          </div>
                      )}
                      
                      <div className="flex justify-between items-end pt-3 border-t border-gray-200 mt-2">
                          <span className="text-sm font-bold text-primary">Investissement Total</span>
                          <div className="text-right h-8 flex items-center justify-end">
                               {isUpdatingPromo || isLoading ? (
                                  <div className="flex items-center gap-2 text-xs text-secondary animate-pulse"><Loader2 className="w-4 h-4 animate-spin" /><span>Calcul...</span></div>
                               ) : (
                                  <span className="text-2xl font-bold text-primary tracking-tight tabular-nums transition-all duration-300">
                                    {amountDisplay.toFixed(2)}€
                                  </span>
                               )}
                          </div>
                      </div>
                  </div>

                  {/* PROMO */}
                  <div className="mb-6 relative">
                      <div className="flex gap-2">
                          <div className="relative flex-1 group">
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                                  <Tag size={14} />
                              </div>
                              <input 
                                  type="text" 
                                  placeholder="CODE PROMO"
                                  value={promoCode}
                                  onChange={(e) => setPromoCode(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                                  disabled={isUpdatingPromo || isLoading || !!discountInfo}
                                  className="w-full bg-surface-light shadow-inner rounded-xl py-3 pl-9 pr-4 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-slate-900/50 focus:bg-white transition-all uppercase placeholder:text-gray-300 disabled:opacity-50"
                              />
                          </div>
                          {discountInfo ? (
                               <button onClick={handleRemovePromo} className="px-4 py-2 bg-gray-200 text-gray-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-300 transition-all shadow-sm">RETIRER</button>
                          ) : (
                              <button onClick={handleApplyPromo} disabled={!promoCode || isUpdatingPromo} className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-lg disabled:opacity-50">OK</button>
                          )}
                      </div>
                      {errorMessage && <p className="text-[10px] text-red-500 mt-2 font-bold ml-1 flex items-center gap-1 animate-in fade-in"><AlertCircle size={10} /> {errorMessage}</p>}
                      {successMessage && !errorMessage && <p className="text-[10px] text-accent mt-2 font-bold ml-1 flex items-center gap-1 animate-in fade-in"><Check size={10} strokeWidth={4} /> {successMessage}</p>}
                  </div>

                  {/* CHECKBOX LÉGALE SMART */}
                  {!isLoading && (
                    <div className={`mb-6 p-3 rounded-xl border transition-all duration-300 ${legalAccepted ? 'bg-surface-light border-gray-100' : 'bg-red-50 border-red-100'}`}>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center mt-0.5">
                          <input 
                            type="checkbox" 
                            className="peer sr-only" 
                            checked={legalAccepted}
                            onChange={(e) => setLegalAccepted(e.target.checked)}
                          />
                          <div className={`w-4 h-4 border-2 rounded transition-all ${legalAccepted ? 'border-primary bg-primary' : 'border-red-300 bg-white'}`}></div>
                          <Check size={10} className="absolute left-0.5 top-0.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={4} />
                        </div>
                        <span className="text-[10px] leading-relaxed text-secondary group-hover:text-primary transition-colors">
                          Je demande l'activation immédiate de mon accompagnement et j'accepte les conditions de renonciation au droit de rétractation conformément aux <Link href="/cgv" className="underline font-bold decoration-slate-900/30 hover:decoration-slate-900 transition-all">CGV</Link>.
                        </span>
                      </label>
                    </div>
                  )}

                  {/* ZONE PAIEMENT / ACTIVATION */}
                  <div className="relative min-h-[100px]">
                      
                      {!legalAccepted && !isLoading && (
                        <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[2px] flex items-center justify-center rounded-xl cursor-not-allowed transition-all duration-500">
                           <div className="bg-slate-900 text-white px-4 py-2 rounded-lg text-[10px] font-bold shadow-xl flex items-center gap-2 animate-bounce">
                             <Info size={12} /> Cochez la case pour valider l'admission
                           </div>
                        </div>
                      )}

                      {/* Flux Payant (Stripe) */}
                      {clientSecret && !isFree && !isLoading && (
                          <div className="animate-in fade-in duration-500">
                              <Elements options={{ clientSecret, appearance }} stripe={stripePromise}>
                                  <CheckoutForm amount={amountDisplay} />
                              </Elements>
                          </div>
                      )}

                      {/* Flux Gratuit (VIP) */}
                      {isFree && !isLoading && (
                          <div className="animate-in zoom-in-95 bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center space-y-6 shadow-inner relative overflow-hidden">
                              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-slate-200/50 rounded-full blur-2xl opacity-50"></div>
                              
                              <div className="relative z-10">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-md text-slate-900 mb-4 ring-4 ring-slate-100">
                                    <Zap size={28} fill="currentColor" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Admission VIP Confirmée</h3>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">Accès intégral au programme OMNI™ offert.</p>
                                </div>
                              </div>

                              <button
                                  onClick={handleSecureFreeAccess}
                                  disabled={!legalAccepted}
                                  className="w-full py-4 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
                              >
                                  <span>Finaliser l'Admission</span>
                                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                              </button>
                          </div>
                      )}
                  </div>
                  
                  <div className="mt-8 pt-4 border-t border-gray-100 text-center">
                      <p className="text-[9px] text-gray-400 flex items-center justify-center gap-1.5 font-bold uppercase tracking-widest">
                          <ShieldCheck size={10} /> Paiement SSL Sécurisé
                      </p>
                  </div>
              </div>
          </div>
        </div>
      </div>

      {/* === FOOTER GLOBAL === */}
      <footer className="w-full border-t border-gray-100 bg-surface-light py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-[10px] text-secondary text-center md:text-left">
                <p className="font-bold text-primary">STRYV lab</p>
                <p>Laboratoire d'Ingénierie du Potentiel Humain</p>
            </div>
            <div className="flex gap-6 text-[10px] font-bold text-secondary uppercase tracking-widest">
                <Link href="/cgv" className="hover:text-primary transition-colors">CGV</Link>
                <Link href="/confidentialite" className="hover:text-primary transition-colors">Confidentialité</Link>
                <Link href="/mentions-legales" className="hover:text-primary transition-colors">Mentions Légales</Link>
            </div>
            <div className="text-[10px] text-secondary/60">
                © {new Date().getFullYear()} STRYV lab. Tous droits réservés.
            </div>
        </div>
      </footer>

    </main>
  );
}