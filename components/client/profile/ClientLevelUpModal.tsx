"use client";

import { CSSProperties, useEffect, useState } from "react";
import { LEVEL_THRESHOLDS } from "@/lib/checkins/points";
import Image from "next/image";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function ClientLevelUpModal({
  currentLevel,
}: {
  currentLevel: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [unlockedLevel, setUnlockedLevel] = useState<string | null>(null);
  const [collectionBefore, setCollectionBefore] = useState(0);
  const [gender, setGender] = useState<"male" | "female">("male");
  const supabase = createClientComponentClient();

  useEffect(() => {
    setMounted(true);

    // Fetch user gender for correct trophy variant
    const fetchGender = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("coach_clients")
          .select("gender")
          .eq("user_id", user.id)
          .single();
        if (data?.gender === "female") {
          setGender("female");
        }
      }
    };
    fetchGender();
  }, [supabase]);

  useEffect(() => {
    if (!mounted || !currentLevel) return;

    const storedLevelKey = "stryvr_client_last_seen_level";
    const storedLevel = localStorage.getItem(storedLevelKey);

    if (storedLevel && storedLevel !== currentLevel) {
      const getRank = (lvl: string) =>
        LEVEL_THRESHOLDS.findIndex((t) => t.level === lvl);
      const oldRank = getRank(storedLevel);
      const newRank = getRank(currentLevel);

      // Attention : l'index le plus petit (0) est le grade le plus élevé (Master) car ordonné DESC
      if (newRank !== -1 && oldRank !== -1 && newRank < oldRank) {
        setUnlockedLevel(currentLevel);
        setCollectionBefore(LEVEL_THRESHOLDS.length - oldRank);
        setShowModal(true);
        triggerHaptic();
      }
    }

    if (storedLevel !== currentLevel) {
      localStorage.setItem(storedLevelKey, currentLevel);
    }
  }, [mounted, currentLevel]);

  const triggerHaptic = async () => {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Heavy });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 200);
    } catch (e) {
      // Ignored if not running in capacitor (web)
    }
  };

  if (!showModal || !unlockedLevel) return null;

  const getTrophyImage = () => {
    const trophyAsset = unlockedLevel === "iron" ? "metal" : unlockedLevel;
    return `/images/trophies/relics-v2/${trophyAsset}-${gender}.png`;
  };

  const rankCopy: Record<string, string> = {
    iron: "Métal",
    bronze: "Bronze",
    silver: "Argent",
    gold: "Or",
    platinum: "Platine",
    diamond: "Diamant",
    master: "Maître",
    olympian: "Olympien",
  };
  const currentRank = rankCopy[unlockedLevel] ?? unlockedLevel;
  const collectionAfter = LEVEL_THRESHOLDS.length - LEVEL_THRESHOLDS.findIndex((entry) => entry.level === unlockedLevel);
  const rankEffects: Record<string, { accent: string; glow: string }> = {
    iron: { accent: "#d2d6db", glow: "rgba(210,214,219,.42)" },
    bronze: { accent: "#d58a53", glow: "rgba(213,138,83,.44)" },
    silver: { accent: "#c8e5f1", glow: "rgba(171,221,242,.45)" },
    gold: { accent: "#f6cf68", glow: "rgba(246,207,104,.48)" },
    platinum: { accent: "#63d4dd", glow: "rgba(99,212,221,.46)" },
    diamond: { accent: "#c9f6ff", glow: "rgba(170,233,255,.52)" },
    master: { accent: "#aa7bf2", glow: "rgba(170,123,242,.48)" },
    olympian: { accent: "#ef5660", glow: "rgba(239,86,96,.5)" },
  };
  const effect = rankEffects[unlockedLevel] ?? rankEffects.iron;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rank-reveal-title" className="rank-reveal fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/95 px-5 pb-8 pt-6 text-white">
      <div className="rank-reveal__backdrop absolute inset-0" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <p className="rank-reveal__eyebrow">NOUVEAU RANG</p>
        <div className="rank-reveal__stage relative mt-1 flex w-full items-center justify-center">
          <div className="rank-reveal__aura" style={{ background: `radial-gradient(circle, ${effect.glow} 0%, transparent 66%)` }} />
          <div className="rank-reveal__ring rank-reveal__ring--outer" style={{ borderColor: effect.accent }} />
          <div className="rank-reveal__ring rank-reveal__ring--inner" style={{ borderColor: effect.accent }} />
          {Array.from({ length: 14 }).map((_, index) => (
            <span
              key={index}
              className="rank-reveal__particle"
              style={{
                "--particle-angle": `${(360 / 14) * index}deg`,
                "--particle-delay": `${index * 45}ms`,
                backgroundColor: effect.accent,
                boxShadow: `0 0 12px ${effect.glow}`,
              } as CSSProperties}
            />
          ))}
          {/* No oval, contact shadow or artificial ground: the trophy stays truly isolated. */}
          <Image
            src={getTrophyImage()}
            alt={`Trophée ${currentRank}`}
            width={520}
            height={520}
            className="rank-reveal__trophy relative z-10 h-auto max-h-[59dvh] w-full object-contain"
            unoptimized // AI images might not be optimized yet
          />
        </div>

        <h2 id="rank-reveal-title" className="rank-reveal__title mt-4 text-center text-4xl font-black uppercase tracking-[0.13em] sm:text-5xl" style={{ color: effect.accent }}>
          {currentRank}
        </h2>
        <p className="rank-reveal__subtitle mt-2 text-center text-sm font-medium text-white/68">
          Trophée ajouté à ta collection
        </p>
        <div className="rank-reveal__collection mt-5 flex items-center gap-3 rounded-full border border-white/[0.12] bg-white/[0.055] px-4 py-2 text-sm backdrop-blur-sm">
          <span className="text-white/52">Collection</span>
          <span className="font-semibold tabular-nums text-white/65">{collectionBefore}/{LEVEL_THRESHOLDS.length}</span>
          <span className="rank-reveal__arrow" style={{ color: effect.accent }}>→</span>
          <span className="rank-reveal__count font-semibold tabular-nums" style={{ color: effect.accent }}>{collectionAfter}/{LEVEL_THRESHOLDS.length}</span>
        </div>

        <button
          onClick={() => setShowModal(false)}
          className="rank-reveal__continue mt-7 rounded-2xl border border-white/[0.14] bg-white px-9 py-3.5 text-sm font-bold text-black transition active:scale-[0.97]"
        >
          Continuer
        </button>
      </div>

      <style jsx global>{`
        .rank-reveal {
          animation: rank-reveal-fade 420ms ease-out both;
        }
        .rank-reveal__backdrop {
          background:
            radial-gradient(circle at 50% 44%, rgba(255,255,255,.06), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,.025), transparent 34%);
        }
        .rank-reveal__eyebrow {
          animation: rank-reveal-copy 500ms 160ms cubic-bezier(.16,1,.3,1) both;
          color: rgba(255,255,255,.48);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .22em;
        }
        .rank-reveal__stage {
          min-height: min(59dvh, 560px);
        }
        .rank-reveal__aura {
          position: absolute;
          width: 135%;
          aspect-ratio: 1;
          animation: rank-reveal-aura 1.8s 120ms ease-out both;
          filter: blur(5px);
        }
        .rank-reveal__ring {
          position: absolute;
          border: 1px solid;
          border-radius: 999px;
          opacity: .38;
        }
        .rank-reveal__ring--outer {
          width: 78%;
          aspect-ratio: 1;
          animation: rank-reveal-ring 1.1s 130ms cubic-bezier(.16,1,.3,1) both;
        }
        .rank-reveal__ring--inner {
          width: 56%;
          aspect-ratio: 1;
          animation: rank-reveal-ring 1.1s 210ms cubic-bezier(.16,1,.3,1) both reverse;
        }
        .rank-reveal__particle {
          position: absolute;
          z-index: 0;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          animation: rank-reveal-particle 900ms var(--particle-delay) cubic-bezier(.16,1,.3,1) both;
          transform: rotate(var(--particle-angle)) translateY(-42px);
        }
        .rank-reveal__trophy {
          animation: rank-reveal-trophy 920ms 90ms cubic-bezier(.16,1,.3,1) both;
          filter: none !important;
          mix-blend-mode: normal !important;
        }
        .rank-reveal__title,
        .rank-reveal__subtitle,
        .rank-reveal__collection,
        .rank-reveal__continue {
          animation: rank-reveal-copy 620ms 560ms cubic-bezier(.16,1,.3,1) both;
        }
        .rank-reveal__collection { animation-delay: 700ms; }
        .rank-reveal__continue { animation-delay: 820ms; }
        .rank-reveal__count { animation: rank-reveal-count 620ms 820ms cubic-bezier(.16,1,.3,1) both; }
        .rank-reveal__continue:focus-visible { outline: 2px solid white; outline-offset: 4px; }
        @keyframes rank-reveal-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rank-reveal-trophy {
          0% { opacity: 0; transform: scale(.52) translateY(46px); }
          58% { opacity: 1; transform: scale(1.055) translateY(-4px); }
          78% { transform: scale(.985) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes rank-reveal-aura {
          0% { opacity: 0; transform: scale(.34); }
          52% { opacity: 1; transform: scale(1); }
          100% { opacity: .52; transform: scale(1.14); }
        }
        @keyframes rank-reveal-ring {
          from { opacity: 0; transform: scale(.32); }
          to { opacity: .38; transform: scale(1); }
        }
        @keyframes rank-reveal-particle {
          0% { opacity: 0; transform: rotate(var(--particle-angle)) translateY(-32px) scale(.2); }
          35% { opacity: 1; }
          100% { opacity: 0; transform: rotate(var(--particle-angle)) translateY(-180px) scale(1); }
        }
        @keyframes rank-reveal-copy {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rank-reveal-count {
          0% { opacity: 0; transform: translateX(-8px) scale(.92); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .rank-reveal, .rank-reveal *, .rank-reveal *::before, .rank-reveal *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
