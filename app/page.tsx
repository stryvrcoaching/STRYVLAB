"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  User,
  Users,
  Mail,
  Lock,
  Loader2,
  ChevronLeft,
  ChevronDown,
  Briefcase,
  Activity,
  Phone,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Utensils,
  BarChart3,
  Moon,
  RefreshCw,
  Droplet,
  HeartPulse,
  Dumbbell,
  Brain,
  Layers,
  Zap,
  Database,
  FileText,
  ArrowRight,
  Search,
  MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { login, signup, resendEmail } from "@/app/auth/login/actions";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── DATA ────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    id: "macros",
    title: "Kcal & Macros",
    icon: Utensils,
    desc: "Besoins énergétiques et segmentation des nutriments (BMR, NEAT) selon le profil métabolique.",
  },
  {
    id: "bodyfat",
    title: "Body Fat %",
    icon: BarChart3,
    desc: "Composition corporelle précise via les protocoles Navy et Jackson-Pollock.",
  },
  {
    id: "cycle",
    title: "Cycle Sync",
    icon: Moon,
    desc: "Synchronisation nutrition/entraînement avec les cycles hormonaux pour la performance féminine.",
  },
  {
    id: "carb",
    title: "Carb Cycling",
    icon: RefreshCw,
    desc: "Cyclage des glucides pour optimiser la sensibilité à l'insuline et relancer le métabolisme.",
  },
  {
    id: "hydro",
    title: "Hydratation",
    icon: Droplet,
    desc: "Suivi hydrique et électrolytique personnalisé selon l'effort, le climat et le métabolisme.",
  },
  {
    id: "hr",
    title: "HR Zones",
    icon: HeartPulse,
    desc: "Prescription d'intensité précise via Karvonen pour le travail cardiovasculaire et VO2 Max.",
  },
  {
    id: "1rm",
    title: "1RM Calc.",
    icon: Dumbbell,
    desc: "Estimation de la force maximale pour définir les charges théoriques sans risque de blessure.",
  },
  {
    id: "neuro",
    title: "Neuro Profile",
    icon: Brain,
    desc: "Individualisation de l'entraînement selon la dominance neurochimique de l'athlète.",
  },
  {
    id: "stress",
    title: "Charge Allost.",
    icon: Activity,
    desc: "Surveillance nerveuse globale (sommeil, fatigue, cortisol) pour ajuster la charge d'entraînement.",
  },
  {
    id: "mrv",
    title: "MRV Estim.",
    icon: Layers,
    desc: "Volume maximal récupérable pour saturer l'hypertrophie sans saturation systémique.",
  },
  {
    id: "morpho",
    title: "Morpho",
    icon: Zap,
    desc: "Analyse visuelle IA des leviers articulaires et de la morphologie pour adapter chaque mouvement.",
    isNew: true,
  },
];

const SIGNUP_TOOLS = [
  "Excel / Sheets",
  "WhatsApp",
  "Email",
  "Notion / Docs",
  "Hevy",
  "TrueCoach",
  "MyFitnessPal",
  "Trainerize",
  "Cahier / Papier",
  "Canva",
  "Google Forms",
  "Instagram DM",
];

const SIGNUP_CHALLENGES = [
  "Trop de temps passé en administration",
  "Suivi dispersé entre plusieurs outils",
  "Difficultés à créer des programmes",
  "Manque de visibilité sur la progression client",
  "Communication compliquée avec les clients",
  "Gestion des paiements et factures",
  "Pas de process de suivi structuré",
];

const SIGNUP_DISCOVERY = [
  "Instagram / TikTok",
  "Recommandation d'un collègue",
  "Bouche à oreille",
  "Google",
  "YouTube / Podcast",
  "Événement / formation",
];

// ─── PLATEFORME COACH ────────────────────────────────────────────────────────

const COACH_FEATURES = [
  {
    icon: Users,
    label: "Tous vos clients au même endroit",
    desc: "Fini les fichiers Excel éparpillés. Chaque client a son dossier complet — objectifs, historique, photos, programme et paiements.",
  },
  {
    icon: Layers,
    label: "Des programmes générés en 1 clic",
    desc: "Décrivez le profil de votre client, STRYV construit le programme adapté à son niveau, son équipement et ses objectifs.",
  },
  {
    icon: FileText,
    label: "Vos templates, matchés automatiquement",
    desc: "Créez vos modèles de programmes une seule fois. STRYV les adapte à chaque client selon son matériel et son niveau réel.",
  },
  {
    icon: BarChart3,
    label: "Visualisez la progression en un coup d'œil",
    desc: "Vos clients progressent-ils vraiment ? Des graphiques clairs pour répondre à cette question sans chercher dans vos notes.",
  },
  {
    icon: Database,
    label: "Gérez vos revenus sans comptable",
    desc: "Abonnements, paiements, formules — tout est centralisé. Vous savez en temps réel ce que vous gagnez chaque mois.",
  },
  {
    icon: MessageCircle,
    label: "Des bilans qui se remplissent seuls",
    desc: "Envoyez un formulaire à votre client en 1 clic. Il le complète depuis son téléphone, vous recevez les résultats directement.",
  },
];

// ─── CLIENT APP ──────────────────────────────────────────────────────────────

const CLIENT_FEATURES = [
  {
    icon: Dumbbell,
    label: "Le programme toujours disponible",
    desc: "Vos clients voient leurs séances, leurs séries et leurs charges depuis leur téléphone, à tout moment.",
  },
  {
    icon: Activity,
    label: "Log de séance intégré",
    desc: "Ils notent leurs performances directement dans l'app. Vous les consultez en temps réel depuis votre tableau de bord.",
  },
  {
    icon: Moon,
    label: "Bilans hebdo sur mobile",
    desc: "Récupération, nutrition, sommeil — ils répondent en 2 minutes depuis leur téléphone, sans inscription complexe.",
  },
  {
    icon: HeartPulse,
    label: "Leur progression visible",
    desc: "Photos, courbes de poids, résultats d'analyse — tout s'accumule automatiquement pour motiver et fidéliser.",
  },
];

// ─── ANIMATION VARIANTS ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const formVariants = {
  hidden: { opacity: 0, x: 10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.3, ease: "easeIn" } },
};

// ─── SHARED PRIMITIVES ────────────────────────────────────────────────────────

// Label natif — pas shadcn (évite le conflit text-sm base)
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">
      {children}
    </label>
  );
}

// Input natif — pas shadcn (évite les conflits h-8 / bg-transparent)
function FieldInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl bg-[#0a0a0a] border-input px-4 py-0 text-[14px] font-medium text-white placeholder:text-white/20",
        "outline-none transition-all duration-200",
        "focus:ring-0 focus:outline-none",
        "h-[52px]",
        className,
      )}
      {...props}
    />
  );
}

// Barre de progression native
function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="h-[2px] w-full rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-[#1f8a65]"
        initial={{ width: 0 }}
        animate={{ width: `${(step / total) * 100}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type FormValues = {
  firstName: string;
  lastName: string;
  coachName: string;
  phone: string;
  experienceLevel: string;
  activeClients: string;
  discoverySource: string;
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
};

type AuthCardProps = {
  isLogin: boolean;
  setIsLogin: (v: boolean) => void;
  isForgotPassword: boolean;
  setIsForgotPassword: (v: boolean) => void;
  forgotEmail: string;
  setForgotEmail: (v: string) => void;
  forgotStatus: "idle" | "loading" | "sent";
  handleForgotPassword: (e: React.FormEvent) => void;
  step: number;
  isLoading: boolean;
  error: string | null;
  success: string | null;
  resendStatus: "idle" | "loading" | "success" | "error";
  formValues: FormValues;
  setFormValue: (field: keyof FormValues, value: string) => void;
  selectedTools: string[];
  setSelectedTools: (v: string[]) => void;
  selectedChallenges: string[];
  setSelectedChallenges: (v: string[]) => void;
  handleBack: () => void;
  handleResend: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

// ─── AUTH CARD ────────────────────────────────────────────────────────────────

function AuthFormCard({
  isLogin,
  setIsLogin,
  isForgotPassword,
  setIsForgotPassword,
  forgotEmail,
  setForgotEmail,
  forgotStatus,
  handleForgotPassword,
  step,
  isLoading,
  error,
  success,
  resendStatus,
  formValues,
  setFormValue,
  selectedTools,
  setSelectedTools,
  selectedChallenges,
  setSelectedChallenges,
  handleBack,
  handleResend,
  handleSubmit,
}: AuthCardProps) {
  const toggleTool = (item: string) =>
    setSelectedTools(
      selectedTools.includes(item)
        ? selectedTools.filter((i) => i !== item)
        : [...selectedTools, item],
    );

  const toggleChallenge = (item: string) =>
    setSelectedChallenges(
      selectedChallenges.includes(item)
        ? selectedChallenges.filter((i) => i !== item)
        : [...selectedChallenges, item],
    );

  const f = (field: keyof FormValues) => ({
    value: formValues[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFormValue(field, e.target.value),
  });

  const stepLabel = isLogin
    ? "Accès Coach"
    : step === 1
      ? "Votre profil"
      : step === 2
        ? "Votre pratique"
        : "Votre accès";

  const stepHint = isLogin
    ? "Identifiez-vous pour accéder à votre espace coach."
    : step === 1
      ? "Configurez votre espace en quelques secondes."
      : step === 2
        ? "Parlez-nous de votre activité pour personnaliser votre espace."
        : "Choisissez votre email et mot de passe.";

  const StepIcon = isLogin
    ? User
    : step === 1
      ? User
      : step === 2
        ? Users
        : Lock;

  if (isForgotPassword) {
    return (
      <div className="relative flex min-h-[520px] flex-col overflow-hidden rounded-2xl bg-[#181818] border-subtle">
        <div className="flex-1 px-8 pt-9 pb-8 md:px-10 flex flex-col">
          <button
            type="button"
            onClick={() => setIsForgotPassword(false)}
            className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/60 transition-colors mb-8 self-start"
          >
            <ChevronLeft size={13} />
            Retour à la connexion
          </button>

          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04]">
            <Mail size={20} className="text-[#1f8a65]" strokeWidth={1.5} />
          </div>
          <h2 className="mb-1.5 text-center text-xl font-semibold text-white">
            Mot de passe oublié
          </h2>
          <p className="mx-auto max-w-[280px] text-center text-[11px] text-white/55 leading-relaxed mb-8">
            Saisissez votre adresse e-mail. Un lien de réinitialisation vous sera envoyé.
          </p>

          {forgotStatus === "sent" ? (
            <div className="flex flex-col items-center gap-3 text-center mt-4">
              <CheckCircle2 size={32} className="text-[#1f8a65]" />
              <p className="text-white font-semibold text-sm">E-mail envoyé !</p>
              <p className="text-white/40 text-[12px]">Vérifiez votre boîte mail et cliquez sur le lien reçu.</p>
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="mt-4 text-[11px] text-[#1f8a65] hover:text-[#1f8a65]/80 transition-colors"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5">
                  Adresse e-mail
                </label>
                <div className="relative group/input">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within/input:text-[#1f8a65]"
                    size={16}
                    strokeWidth={1.5}
                  />
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="coach@exemple.com"
                    className="w-full h-[52px] rounded-xl bg-[#0a0a0a] pl-10 pr-4 text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotStatus === "loading"}
                className="group/btn flex h-[52px] w-full items-center justify-between rounded-xl bg-[#1f8a65] pl-5 pr-1.5 transition-all hover:bg-[#217356] active:scale-[0.99] disabled:opacity-50"
              >
                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white">
                  {forgotStatus === "loading" ? "Envoi…" : "Envoyer le lien"}
                </span>
                <div className="flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-black/[0.12]">
                  {forgotStatus === "loading" ? (
                    <Loader2 size={16} className="text-white animate-spin" />
                  ) : (
                    <ArrowRight size={16} className="text-white" />
                  )}
                </div>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex max-h-[calc(100dvh-64px)] xl:max-h-[calc(100dvh-80px)] min-h-[520px] flex-col overflow-hidden rounded-2xl bg-[#181818] border-subtle">
      {/* Header — shrink-0 */}
      <div className="shrink-0 px-8 pt-9 pb-5 md:px-10">
        {/* Progress bar (signup uniquement) */}
        <div className="mb-7">
          {!isLogin ? (
            <StepProgress step={step} total={3} />
          ) : (
            <div className="h-[2px]" />
          )}
        </div>

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04]">
          <StepIcon size={22} className="text-[#1f8a65]" strokeWidth={1.5} />
        </div>

        {/* Title + hint */}
        <h2 className="mb-1.5 text-center text-xl font-semibold leading-tight tracking-tight text-white">
          {stepLabel}
        </h2>
        <p className="mx-auto max-w-[280px] text-center text-[11px] font-medium leading-relaxed text-white/55">
          {stepHint}
        </p>
      </div>

      {/* Scrollable body */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-8 pb-2 md:px-10">
        {/* Error */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-950/30 p-3.5"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-[12px] font-semibold leading-snug text-red-200">
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success + resend */}
        <AnimatePresence>
          {isLogin && success && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 rounded-xl bg-[#1f4637]/30 p-4"
            >
              <div className="mb-3 flex items-start gap-2.5">
                <CheckCircle2
                  size={15}
                  className="mt-0.5 shrink-0 text-[#1f8a65]"
                />
                <p className="text-[12px] font-semibold leading-snug text-emerald-100">
                  {success}
                </p>
              </div>
              <button
                type="button"
                onClick={handleResend}
                disabled={
                  resendStatus === "loading" || resendStatus === "success"
                }
                className="w-full rounded-lg bg-[#1f8a65]/[0.08] py-2 text-[11px] font-bold text-[#1f8a65] transition-all hover:bg-[#1f8a65]/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resendStatus === "loading" && "Envoi en cours..."}
                {resendStatus === "success" && "✓ E-mail renvoyé"}
                {resendStatus === "error" && "Erreur — réessayer"}
                {resendStatus === "idle" && "Renvoyer l'e-mail de confirmation"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.div
                key="login"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={formVariants}
                className="space-y-4"
              >
                <div>
                  <FieldLabel>Email Coach</FieldLabel>
                  <div className="relative group/input">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within/input:text-[#1f8a65]"
                      size={16}
                      strokeWidth={1.5}
                    />
                    <FieldInput
                      name="email"
                      type="email"
                      required
                      placeholder="nom@stryvlab.com"
                      className="pl-10"
                      {...f("email")}
                    />
                  </div>
                </div>

                <div className="pb-1">
                  <div className="mb-1.5 flex items-center justify-between">
                    <FieldLabel>Mot de Passe</FieldLabel>
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setForgotEmail(formValues.email); }}
                      className="text-[10px] font-bold text-[#1f8a65]/70 hover:text-[#1f8a65] transition-colors"
                    >
                      Oubliée ?
                    </button>
                  </div>
                  <div className="relative group/input">
                    <Lock
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within/input:text-[#1f8a65]"
                      size={16}
                      strokeWidth={1.5}
                    />
                    <FieldInput
                      name="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      className="pl-10 tracking-[0.3em]"
                      {...f("password")}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={formVariants}
                className="space-y-4"
              >
                {/* Step 1 */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Prénom</FieldLabel>
                        <FieldInput
                          name="firstName"
                          type="text"
                          required
                          placeholder="Jean"
                          {...f("firstName")}
                        />
                      </div>
                      <div>
                        <FieldLabel>Nom</FieldLabel>
                        <FieldInput
                          name="lastName"
                          type="text"
                          required
                          placeholder="Dupont"
                          {...f("lastName")}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Nom Studio / Lab</FieldLabel>
                      <div className="relative group/input">
                        <Briefcase
                          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within/input:text-[#1f8a65]"
                          size={16}
                          strokeWidth={1.5}
                        />
                        <FieldInput
                          name="coachName"
                          type="text"
                          placeholder="STRYV Performance Lab"
                          className="pl-10"
                          {...f("coachName")}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Téléphone</FieldLabel>
                      <div className="relative group/input">
                        <Phone
                          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within/input:text-[#1f8a65]"
                          size={16}
                          strokeWidth={1.5}
                        />
                        <FieldInput
                          name="phone"
                          type="tel"
                          required
                          placeholder="+33 6 ..."
                          className="pl-10"
                          {...f("phone")}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 */}
                {step === 2 && (
                  <div className="space-y-5">
                    {/* Expérience + Clients */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel>Expérience</FieldLabel>
                        <div className="relative">
                          <Activity
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20"
                            size={14}
                            strokeWidth={1.5}
                          />
                          <select
                            name="experienceLevel"
                            required
                            {...f("experienceLevel")}
                            className="h-[52px] w-full appearance-none rounded-xl bg-[#0a0a0a] border-input pl-9 pr-8 text-[13px] font-medium text-white outline-none transition-all focus:outline-none [&>option]:bg-[#0a0a0a]"
                          >
                            <option value="" disabled>
                              Niveau ?
                            </option>
                            <option value="debutant">Débutant (- 1 an)</option>
                            <option value="intermediaire">
                              Intermédiaire (1–3 ans)
                            </option>
                            <option value="confirme">Confirmé (3–5 ans)</option>
                            <option value="expert">Expert (5 ans +)</option>
                          </select>
                          <ChevronDown
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/25"
                            size={13}
                          />
                        </div>
                      </div>
                      <div>
                        <FieldLabel>Clients actifs</FieldLabel>
                        <div className="relative">
                          <Users
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20"
                            size={14}
                            strokeWidth={1.5}
                          />
                          <select
                            name="activeClients"
                            required
                            {...f("activeClients")}
                            className="h-[52px] w-full appearance-none rounded-xl bg-[#0a0a0a] border-input pl-9 pr-8 text-[13px] font-medium text-white outline-none transition-all focus:outline-none [&>option]:bg-[#0a0a0a]"
                          >
                            <option value="" disabled>
                              Combien ?
                            </option>
                            <option value="0_5">Moins de 5</option>
                            <option value="5_15">5 à 15</option>
                            <option value="15_30">15 à 30</option>
                            <option value="30_plus">Plus de 30</option>
                          </select>
                          <ChevronDown
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/25"
                            size={13}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Outils */}
                    <input
                      type="hidden"
                      name="currentTools"
                      value={selectedTools.join(", ")}
                    />
                    <div>
                      <FieldLabel>Outils utilisés actuellement</FieldLabel>
                      <div className="grid grid-cols-3 gap-1.5">
                        {SIGNUP_TOOLS.map((tool) => (
                          <button
                            key={tool}
                            type="button"
                            onClick={() => toggleTool(tool)}
                            className={cn(
                              "rounded-lg px-2 py-2 text-center text-[10px] font-semibold leading-tight transition-all",
                              selectedTools.includes(tool)
                                ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                                : "bg-white/[0.02] text-white/35 hover:bg-white/[0.05] hover:text-white/60",
                            )}
                          >
                            {tool}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Challenges */}
                    <input
                      type="hidden"
                      name="mainChallenges"
                      value={selectedChallenges.join(", ")}
                    />
                    <div>
                      <FieldLabel>
                        Ce qui vous pose problème aujourd'hui
                      </FieldLabel>
                      <div className="flex flex-col gap-1.5">
                        {SIGNUP_CHALLENGES.map((challenge) => (
                          <button
                            key={challenge}
                            type="button"
                            onClick={() => toggleChallenge(challenge)}
                            className={cn(
                              "rounded-lg px-3.5 py-2.5 text-left text-[11px] font-medium transition-all",
                              selectedChallenges.includes(challenge)
                                ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                                : "bg-white/[0.02] text-white/35 hover:bg-white/[0.05] hover:text-white/60",
                            )}
                          >
                            {challenge}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Discovery */}
                    <div className="pb-1">
                      <FieldLabel>Comment nous avez-vous connu ?</FieldLabel>
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
                          size={15}
                          strokeWidth={1.5}
                        />
                        <select
                          name="discoverySource"
                          {...f("discoverySource")}
                          className="h-[52px] w-full appearance-none rounded-xl border border-white/[0.08] bg-[#121212] pl-10 pr-8 text-[13px] font-medium text-white outline-none transition-all focus:outline-none [&>option]:bg-[#0a0a0a]"
                        >
                          <option value="">Sélectionner...</option>
                          {SIGNUP_DISCOVERY.map((source) => (
                            <option key={source} value={source}>
                              {source}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/25"
                          size={14}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 */}
                {step === 3 && (
                  <div className="space-y-4 pb-1">
                    <div>
                      <FieldLabel>Email de connexion</FieldLabel>
                      <div className="relative group/input">
                        <Mail
                          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within/input:text-[#1f8a65]"
                          size={16}
                          strokeWidth={1.5}
                        />
                        <FieldInput
                          name="email"
                          type="email"
                          required
                          placeholder="nom@exemple.com"
                          className="pl-10"
                          {...f("email")}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Confirmer l&apos;email</FieldLabel>
                      <div className="relative group/input">
                        <Mail
                          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within/input:text-[#1f8a65]"
                          size={16}
                          strokeWidth={1.5}
                        />
                        <FieldInput
                          name="confirmEmail"
                          type="email"
                          required
                          placeholder="nom@exemple.com"
                          className="pl-10"
                          autoComplete="off"
                          {...f("confirmEmail")}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Mot de passe</FieldLabel>
                      <FieldInput
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                        className="tracking-[0.3em]"
                        {...f("password")}
                      />
                    </div>
                    <div>
                      <FieldLabel>Confirmer le mot de passe</FieldLabel>
                      <FieldInput
                        name="confirmPassword"
                        type="password"
                        required
                        placeholder="••••••••"
                        className="tracking-[0.3em]"
                        {...f("confirmPassword")}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit row */}
          <div className="flex gap-2.5 pt-5 pb-1">
            {!isLogin && (
              <button
                type="button"
                onClick={handleBack}
                className="group flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-white/[0.03] text-white/35 transition-all hover:bg-white/[0.06] hover:text-white/60 active:scale-[0.97]"
              >
                <ChevronLeft
                  size={18}
                  className="transition-transform group-hover:-translate-x-0.5"
                />
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="group/btn flex h-[52px] min-w-0 flex-1 items-center justify-between rounded-xl bg-[#1f8a65] border-button pl-5 pr-1.5 transition-all hover:bg-[#217356] active:scale-[0.99] disabled:opacity-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ShieldCheck
                  size={16}
                  className={cn(
                    "shrink-0 text-white/60",
                    isLoading && "animate-pulse",
                  )}
                />
                <span className="truncate text-[12px] font-bold uppercase tracking-[0.12em] text-white">
                  {isLoading
                    ? "Connexion..."
                    : isLogin
                      ? "Se connecter"
                      : step === 3
                        ? "Créer mon compte"
                        : "Suivant"}
                </span>
              </div>
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-black/[0.12]">
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <ArrowRight
                    size={16}
                    className="text-white transition-transform group-hover/btn:translate-x-0.5"
                    strokeWidth={2.25}
                  />
                )}
              </div>
            </button>
          </div>
        </form>

        {/* Toggle */}
        <div className="mt-5 pb-8 pt-5 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="group text-[11px] font-medium text-white/50 transition-colors hover:text-white/80"
          >
            {isLogin ? (
              <>
                Nouveau sur STRYV ?{" "}
                <span className="font-bold text-[#1f8a65] group-hover:text-[#217356] transition-colors">
                  Créer un compte
                </span>
              </>
            ) : (
              <>
                Déjà un compte ?{" "}
                <span className="font-bold text-[#1f8a65] group-hover:text-[#217356] transition-colors">
                  Se connecter
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION LABEL ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
      {children}
    </p>
  );
}

// ─── TOOLS GRID ───────────────────────────────────────────────────────────────

function ToolsGrid() {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {TOOLS.map((tool) => (
        <Tooltip key={tool.id}>
          <TooltipTrigger>
            <div className="relative group flex flex-col items-center gap-1.5 cursor-default">
              <div className="w-full aspect-square rounded-lg bg-white/[0.04] flex items-center justify-center transition-all duration-150 group-hover:bg-white/[0.08]">
                <tool.icon
                  size={19}
                  className="text-white/60 group-hover:text-white transition-colors duration-150"
                />
              </div>
              <span className="text-[8px] font-medium text-white/45 text-center leading-tight w-full group-hover:text-white/75 transition-colors duration-150">
                {tool.title}
              </span>
              {tool.isNew && (
                <span className="absolute -top-1 -right-1 px-1 py-[1px] text-[6px] font-black uppercase bg-[#1f8a65] text-white rounded-full leading-none">
                  NEW
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-[190px] bg-[#0f0f0f] p-3 text-[11px] leading-relaxed text-white/60 rounded-xl"
          >
            <p>{tool.desc}</p>
          </TooltipContent>
        </Tooltip>
      ))}
      <Tooltip>
        <TooltipTrigger>
          <div className="flex flex-col items-center gap-1.5 cursor-help opacity-25">
            <div className="w-full aspect-square rounded-lg bg-white/[0.02] flex items-center justify-center">
              <Database size={12} className="text-white/40" />
            </div>
            <span className="text-[8px] font-medium text-white/30 uppercase tracking-widest">
              ?
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-[#0f0f0f] text-[11px] text-white/70 rounded-xl"
        >
          Prochainement
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ─── FEATURE ROW (Cursor-style) ───────────────────────────────────────────────

function FeatureRow({
  icon: Icon,
  label,
  desc,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  accent?: boolean;
}) {
  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 hover:bg-white/[0.04] cursor-default">
      <div
        className={cn(
          "mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          accent
            ? "bg-[#1f8a65]/20 text-[#1f8a65]"
            : "bg-white/[0.07] text-white/55 group-hover:text-white/80",
        )}
      >
        <Icon size={13} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-white/90 leading-snug">
          {label}
        </p>
        <p className="text-[11px] text-white/45 leading-relaxed mt-0.5">
          {desc}
        </p>
      </div>
    </div>
  );
}

// ─── LANDING COLUMN ───────────────────────────────────────────────────────────

function LandingColumn({ mounted }: { mounted: boolean }) {
  const router = useRouter();

  return (
    <motion.div
      initial="hidden"
      animate={mounted ? "visible" : "hidden"}
      variants={containerVariants}
      className="w-full lg:w-[55%] rounded-2xl bg-[#181818] border-subtle p-8 lg:p-10 xl:p-12 flex flex-col overflow-y-auto"
    >
      {/* Logo */}
      <motion.div
        variants={itemVariants}
        className="mb-8 inline-flex cursor-pointer items-center gap-3 group"
        onClick={() => router.push("/")}
      >
        <Image
          src="/images/logo.png"
          alt="STRYV"
          width={64}
          height={64}
          className="w-14 h-14 object-contain transition-transform duration-300 group-hover:scale-105"
          priority
        />
        <span className="font-unbounded font-semibold text-2xl text-white tracking-tight leading-none">
          STRYV<span className="font-light text-white/40"> lab</span>
        </span>
      </motion.div>

      {/* Hero */}
      <motion.h1
        variants={itemVariants}
        className="mb-4 text-[2.4rem] md:text-[2.8rem] xl:text-[3rem] font-black text-white tracking-tight leading-[1.05]"
      >
        Évaluer.
        <br />
        <span className="text-[#1f8a65]">Calculer.</span>
        <br />
        <span className="text-white/25">Piloter.</span>
      </motion.h1>

      {/* Subtitle */}
      <motion.div variants={itemVariants} className="mb-8">
        <p className="text-[13px] text-white/60 leading-[1.7] max-w-[400px]">
          Arrêtez de gérer vos clients avec Excel et WhatsApp. STRYV centralise
          tout — programmes, bilans, paiements et analyses.
        </p>
      </motion.div>

      {/* ── Outils ── */}
      <motion.div variants={itemVariants} className="mb-7">
        <SectionLabel>Outils d'analyse</SectionLabel>
        <ToolsGrid />
      </motion.div>

      {/* Divider */}
      <motion.div
        variants={itemVariants}
        className="mb-6 h-px bg-white/[0.07]"
      />

      {/* ── Plateforme Coach ── */}
      <motion.div variants={itemVariants} className="mb-6">
        <SectionLabel>Ce que vous gérez avec STRYV</SectionLabel>
        <div className="grid grid-cols-2 gap-x-2">
          {COACH_FEATURES.map((f) => (
            <FeatureRow
              key={f.label}
              icon={f.icon}
              label={f.label}
              desc={f.desc}
              accent
            />
          ))}
        </div>
      </motion.div>

      {/* Divider */}
      <motion.div
        variants={itemVariants}
        className="mb-6 h-px bg-white/[0.07]"
      />

      {/* ── Mini-app Client ── */}
      <motion.div variants={itemVariants} className="mb-7">
        <SectionLabel>Ce que vivent vos clients</SectionLabel>
        <div className="grid grid-cols-2 gap-x-2">
          {CLIENT_FEATURES.map((f) => (
            <FeatureRow
              key={f.label}
              icon={f.icon}
              label={f.label}
              desc={f.desc}
            />
          ))}
        </div>
      </motion.div>

      {/* Divider */}
      <motion.div
        variants={itemVariants}
        className="mb-6 h-px bg-white/[0.07]"
      />

      {/* ── Stats ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
        {[
          { value: "0", label: "Excel à maintenir" },
          { value: "1", label: "interface pour tout" },
          { value: "100%", label: "fait pour les coachs" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg bg-white/[0.03] p-3.5 text-center"
          >
            <p className="text-xl font-black text-[#1f8a65] leading-none mb-1">
              {s.value}
            </p>
            <p className="text-[9.5px] font-medium text-white/50 leading-tight">
              {s.label}
            </p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function ConnectionPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [formValues, setFormValues] = useState<FormValues>({
    firstName: "",
    lastName: "",
    coachName: "",
    phone: "",
    experienceLevel: "",
    activeClients: "",
    discoverySource: "",
    email: "",
    confirmEmail: "",
    password: "",
    confirmPassword: "",
  });
  const setFormValue = (field: keyof FormValues, value: string) =>
    setFormValues((prev) => ({ ...prev, [field]: value }));
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);

  useEffect(() => setMounted(true), []);

  const handleNext = () => setStep((s) => Math.min(s + 1, 3));
  const handleBack = () =>
    step > 1 ? setStep((s) => s - 1) : setIsLoginWithReset(true);

  const setIsLoginWithReset = (v: boolean, keepSuccess = false) => {
    setIsLogin(v);
    setStep(1);
    setError(null);
    if (!keepSuccess) setSuccess(null);
  };

  const handleResend = async () => {
    if (!formValues.email) {
      setError("Saisissez votre e-mail pour renvoyer le lien.");
      return;
    }

    setResendStatus("loading");
    setError(null);

    try {
      const result = await resendEmail(formValues.email);
      setResendStatus(result.success ? "success" : "error");
      if (result.error) setError(result.error);
    } catch (error) {
      console.error("[homepage] resendEmail failed:", error);
      setResendStatus("error");
      setError("Impossible de renvoyer l’e-mail pour le moment.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotStatus("loading");
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${siteUrl}/auth/reset-password`,
    });
    setForgotStatus("sent");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isLogin) {
        const formData = new FormData(e.currentTarget);
        const result = await login(formData);
        if (result?.error) {
          setError(result.error);
        } else {
          router.push("/dashboard");
        }
      } else {
        if (step < 3) {
          handleNext();
          setIsLoading(false);
          return;
        }
        if (formValues.email !== formValues.confirmEmail) {
          setError("Les adresses e-mail ne correspondent pas.");
          setIsLoading(false);
          return;
        }
        if (formValues.password !== formValues.confirmPassword) {
          setError("Les mots de passe ne correspondent pas.");
          setIsLoading(false);
          return;
        }
        const formData = new FormData();
        Object.entries(formValues).forEach(([k, v]) => formData.set(k, v));
        formData.set("currentTools", selectedTools.join(", "));
        formData.set("currentProcess", selectedChallenges.join(", "));
        const result = await signup(formData);
        if (result?.error) {
          setError(result.error);
        } else {
          setSuccess(
            "Compte créé ! Un e-mail de confirmation vous a été envoyé.",
          );
          setIsLoginWithReset(true, true);
        }
      }
    } catch (error) {
      console.error("[homepage] auth submit failed:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Impossible de contacter le service d’authentification.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const cardProps = {
    isLogin,
    setIsLogin: setIsLoginWithReset,
    isForgotPassword,
    setIsForgotPassword,
    forgotEmail,
    setForgotEmail,
    forgotStatus,
    handleForgotPassword,
    step,
    isLoading,
    error,
    success,
    resendStatus,
    formValues,
    setFormValue,
    selectedTools,
    setSelectedTools,
    selectedChallenges,
    setSelectedChallenges,
    handleBack,
    handleResend,
    handleSubmit,
  };

  return (
    <main className="min-h-screen w-full bg-[#121212] text-white selection:bg-[#1f8a65]/25 selection:text-white flex justify-center p-4 md:p-6 lg:p-8 xl:p-10 relative overflow-x-hidden">
      {/* Glow bg */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 15% 50%, rgba(31,138,101,0.035) 0%, transparent 55%)",
        }}
      />

      {/* Layout */}
      <div className="relative z-10 w-full max-w-[1240px] flex flex-col lg:flex-row items-stretch gap-4 lg:gap-8 xl:gap-10 pt-8 lg:pt-14">
        {/* Left — Landing */}
        <LandingColumn mounted={mounted} />

        {/* Mobile auth */}
        <div className="w-full lg:hidden py-6">
          <div className="mx-auto w-full max-w-[460px]">
            <AuthFormCard {...cardProps} />
          </div>
        </div>

        {/* Desktop spacer */}
        <div className="hidden lg:block lg:w-[45%]" aria-hidden="true" />
      </div>

      {/* Desktop fixed auth — même centrage que le layout scrollable */}
      <div className="hidden lg:flex fixed inset-0 pointer-events-none z-50 items-center justify-center p-4 md:p-6 lg:p-8 xl:p-10">
        <div className="w-full max-w-[1240px] flex flex-row items-stretch gap-4 lg:gap-8 xl:gap-10 pt-8 lg:pt-14">
          <div className="w-[55%] invisible" aria-hidden="true" />
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={mounted ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-[45%] flex items-center pointer-events-auto"
          >
            <div className="w-full">
              <AuthFormCard {...cardProps} />
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
