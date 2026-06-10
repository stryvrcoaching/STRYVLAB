'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/checkout/CheckoutForm';
import { 
  ShieldCheck, 
  FileText, 
  BarChart2, 
  ArrowLeft, 
  Tag, 
  Loader2, 
  Lock, 
  Smartphone, 
  Check, 
  Zap, 
  Info,
  AlertCircle,
  Activity,
  ArrowRight,
  Target,      // Nouvelle icône
  Database     // Nouvelle icône
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Initialisation Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function IPTCheckoutPage() {
  const router = useRouter();
  
  // --- ÉTATS ---
  const [clientSecret, setClientSecret] = useState("");
  const [amountDisplay, setAmountDisplay] = useState(35.00);
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
        body: JSON.stringify({ productId: 'ipt', promoCode: code }),
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
          productId: 'ipt',
          promoCode: discountInfo?.code,
          legalAccepted: true 
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        // Redirection vers votre dossier existant checkout-success/ipt
        const finalUrl = data.redirectUrl.replace('/checkout/success', '/checkout-success/ipt');
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
      
      {/* CONTENU PRINCIPAL */}
      <div className="flex-grow py-12 px-4 flex items-center justify-center">
        <div className="w-full max-w-5xl grid md:grid-cols-12 gap-8 items-start relative z-10">
          
          {/* === GAUCHE : PRÉSENTATION PRODUIT (TEXTES EXACTS) === */}
          <div className="md:col-span-7 space-y-6">
              <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-bold text-secondary hover:text-primary transition-colors uppercase tracking-widest mb-4">
                  <ArrowLeft size={10} /> Annuler
              </Link>

              <div className="bg-surface border border-white/60 p-8 rounded-3xl shadow-soft-out relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent"></div>
                  
                  <div className="mb-8">
                      {/* Badge Exact */}
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-[10px] font-bold tracking-widest text-emerald-700 uppercase mb-4 shadow-sm">
                          <Activity size={12} /> RAPPORT DE POTENTIEL
                      </div>
                      
                      <h1 className="text-4xl font-bold text-primary mb-6 tracking-tight">
                          Analyse IPT™
                      </h1>
                      
                      {/* DESCRIPTION EXACTE (Capture) */}
                      <div className="space-y-6">
                        <p className="text-secondary text-sm leading-relaxed">
                            Analyse structurée permettant de calculer votre <span className="font-bold text-primary">Indice de Potentiel de Transformation (IPT™)</span>. Le paiement donne accès : à l’analyse IPT (collecte et modélisation des données), au calcul de votre score IPT™ (0–100), à un rapport de potentiel de transformation expliquant freins, leviers et priorités.
                        </p>
                        
                        {/* Box "L'ACCÈS COMPREND" */}
                        <div className="bg-surface-light/50 p-6 rounded-2xl border border-gray-100/50">
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-4">L'ACCÈS COMPREND :</p>
                            <ul className="text-sm text-secondary space-y-3">
                                <li className="flex items-start gap-3">
                                    <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                    <span>Analyse IPT complète (Collecte & Modélisation)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                    <span>Calcul de votre Score IPT™ (0-100)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                        <Check size={10} strokeWidth={4} />
                                    </div>
                                    <span>Rapport stratégique : Freins, Leviers & Priorités</span>
                                </li>
                            </ul>
                        </div>

                        {/* Note de bas de page */}
                        <p className="text-[10px] text-gray-400 italic leading-relaxed border-l-2 border-gray-200 pl-3">
                            Note : Ce service ne constitue ni un programme d’entraînement, ni une promesse de résultat, ni un diagnostic médical.
                        </p>
                      </div>
                  </div>

                  {/* GRID 2x2 FONCTIONNALITÉS */}
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-8 mt-8">
                      {/* 1. Data Driven */}
                      <div className="flex gap-3 items-start p-3 rounded-xl hover:bg-surface-light/50 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-surface-light shadow-sm border border-white flex items-center justify-center text-accent flex-shrink-0">
                              <BarChart2 size={16} />
                          </div>
                          <div>
                              <h3 className="text-[10px] font-bold text-primary uppercase tracking-wide">Data Driven</h3>
                              <p className="text-[10px] text-secondary mt-1 leading-snug">Algorithme de notation sur 6 axes.</p>
                          </div>
                      </div>
                      
                      {/* 2. Root Causes */}
                      <div className="flex gap-3 items-start p-3 rounded-xl hover:bg-surface-light/50 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-surface-light shadow-sm border border-white flex items-center justify-center text-accent flex-shrink-0">
                              <FileText size={16} />
                          </div>
                          <div>
                              <h3 className="text-[10px] font-bold text-primary uppercase tracking-wide">Root Causes</h3>
                              <p className="text-[10px] text-secondary mt-1 leading-snug">Détection des blocages profonds.</p>
                          </div>
                      </div>

                      {/* 3. Action Plan (Nouveau) */}
                      <div className="flex gap-3 items-start p-3 rounded-xl hover:bg-surface-light/50 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-surface-light shadow-sm border border-white flex items-center justify-center text-accent flex-shrink-0">
                              <Target size={16} />
                          </div>
                          <div>
                              <h3 className="text-[10px] font-bold text-primary uppercase tracking-wide">Action Plan</h3>
                              <p className="text-[10px] text-secondary mt-1 leading-snug">Stratégie correctrice prioritaire.</p>
                          </div>
                      </div>

                      {/* 4. Private Lab (Nouveau) */}
                      <div className="flex gap-3 items-start p-3 rounded-xl hover:bg-surface-light/50 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-surface-light shadow-sm border border-white flex items-center justify-center text-accent flex-shrink-0">
                              <Database size={16} />
                          </div>
                          <div>
                              <h3 className="text-[10px] font-bold text-primary uppercase tracking-wide">Private Lab</h3>
                              <p className="text-[10px] text-secondary mt-1 leading-snug">Données sécurisées & privées.</p>
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
                          <Lock size={12} className="text-accent"/> Transaction Sécurisée
                      </h2>
                      <div className="flex gap-2 opacity-40">
                          <Smartphone size={16} />
                      </div>
                  </div>

                  {/* RÉCAP */}
                  <div className="space-y-4 mb-6 bg-surface-light/30 p-5 rounded-2xl border border-gray-100 transition-all">
                      <div className="flex justify-between text-xs font-medium text-secondary">
                          <span>Analyse IPT™</span>
                          <span className="tabular-nums">35.00€</span>
                      </div>
                      {discountInfo && (
                           <div className="flex justify-between text-xs font-bold text-accent animate-in fade-in slide-in-from-left-2 duration-300">
                              <span className="flex items-center gap-1"><Tag size={10}/> Remise ({discountInfo.code})</span>
                              <span className="tabular-nums">-{ (discountInfo.amountSaved / 100).toFixed(2) }€</span>
                          </div>
                      )}
                      <div className="flex justify-between items-end pt-3 border-t border-gray-200 mt-2">
                          <span className="text-sm font-bold text-primary">Total TTC</span>
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
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary"><Tag size={14} /></div>
                              <input 
                                  type="text" 
                                  placeholder="CODE PROMO"
                                  value={promoCode}
                                  onChange={(e) => setPromoCode(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                                  disabled={isUpdatingPromo || isLoading || !!discountInfo}
                                  className="w-full bg-surface-light shadow-inner rounded-xl py-3 pl-9 pr-4 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:bg-white transition-all uppercase placeholder:text-gray-300 disabled:opacity-50"
                              />
                          </div>
                          {discountInfo ? (
                               <button onClick={handleRemovePromo} className="px-4 py-2 bg-gray-200 text-gray-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-300 transition-all shadow-sm">RETIRER</button>
                          ) : (
                              <button onClick={handleApplyPromo} disabled={!promoCode || isUpdatingPromo} className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 active:scale-95 transition-all shadow-lg disabled:opacity-50">OK</button>
                          )}
                      </div>
                      {errorMessage && <p className="text-[10px] text-red-500 mt-2 font-bold ml-1 flex items-center gap-1 animate-in fade-in"><AlertCircle size={10} /> {errorMessage}</p>}
                      {successMessage && !errorMessage && <p className="text-[10px] text-accent mt-2 font-bold ml-1 flex items-center gap-1 animate-in fade-in"><Check size={10} strokeWidth={4} /> {successMessage}</p>}
                  </div>

                  {/* CHECKBOX LÉGALE */}
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
                          Je souhaite accéder immédiatement à mon rapport digital. Je comprends qu'en raison de la nature numérique du service, le droit de rétractation ne s'applique plus après activation.
                        </span>
                      </label>
                    </div>
                  )}

                  {/* ZONE PAIEMENT / ACTIVATION */}
                  <div className="relative min-h-[100px]">
                      
                      {/* Masque de sécurité UI */}
                      {!legalAccepted && !isLoading && (
                        <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[2px] flex items-center justify-center rounded-xl cursor-not-allowed transition-all duration-500">
                           <div className="bg-primary text-white px-4 py-2 rounded-lg text-[10px] font-bold shadow-xl flex items-center gap-2 animate-bounce">
                             <Info size={12} /> Cochez la case pour activer l'accès
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

                      {/* Flux Gratuit (VIP) - BOUTON NOIR PRIMARY */}
                      {isFree && !isLoading && (
                          <div className="animate-in zoom-in-95 bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-6 shadow-inner relative overflow-hidden">
                              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-100 rounded-full blur-2xl opacity-50"></div>
                              
                              <div className="relative z-10">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-md text-emerald-600 mb-4 ring-4 ring-emerald-100">
                                    <Zap size={28} fill="currentColor" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-emerald-950">Code VIP Confirmé</h3>
                                    <p className="text-xs text-emerald-700 mt-1 font-medium">Votre accès intégral est validé.</p>
                                </div>
                              </div>

                              <button
                                  onClick={handleSecureFreeAccess}
                                  disabled={!legalAccepted}
                                  className="w-full py-4 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
                              >
                                  <span>Lancer l'analyse</span>
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

      {/* === FOOTER GLOBAL (MOBILE & DESKTOP) === */}
      <footer className="w-full border-t border-gray-100 bg-surface-light py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Identité Vendeur */}
            <div className="text-[10px] text-secondary text-center md:text-left">
                <p className="font-bold text-primary">STRYV lab</p>
                <p>Laboratoire d'Ingénierie du Potentiel Humain</p>
            </div>

            {/* Liens Légaux */}
            <div className="flex gap-6 text-[10px] font-bold text-secondary uppercase tracking-widest">
                <Link href="/cgv" className="hover:text-primary transition-colors">CGV</Link>
                <Link href="/confidentialite" className="hover:text-primary transition-colors">Confidentialité</Link>
                <Link href="/mentions-legales" className="hover:text-primary transition-colors">Mentions Légales</Link>
            </div>

            {/* Copyright */}
            <div className="text-[10px] text-secondary/60">
                © {new Date().getFullYear()} STRYV lab. Tous droits réservés.
            </div>
        </div>
      </footer>

    </main>
  );
}