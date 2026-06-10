"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, Check } from 'lucide-react'; // On utilise Check aussi

interface SwipeButtonProps {
  onSuccess: () => void;
  text?: string;
  className?: string;
}

type SwipeState = "idle" | "dragging" | "success";

export default function SwipeButton({
  onSuccess,
  text = "GLISSER POUR ACTIVER",
  className = "",
}: SwipeButtonProps) {
  const [state, setState] = useState<SwipeState>("idle");
  const [dragX, setDragX] = useState(0);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const maxDrag = useRef(0);
  const isDragging = useRef(false); // Ref pour éviter les stale closures dans les events

  /* CONSTANTES DESIGN SYSTEM */
  const HEIGHT = 64; 
  const PADDING = 6;
  const KNOB_SIZE = HEIGHT - (PADDING * 2); 
  const SUCCESS_THRESHOLD = 0.9; // 90% pour valider

  /* -----------------------------
     HAPTIC ENGINE
  ------------------------------*/
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  };

  /* -----------------------------
     OBSERVER (Plus robuste que window.resize)
  ------------------------------*/
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        maxDrag.current = containerRef.current.offsetWidth - KNOB_SIZE - (PADDING * 2);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  /* -----------------------------
     CORE LOGIC
  ------------------------------*/
  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let x = clientX - rect.left - PADDING - (KNOB_SIZE / 2);
    
    // Clamp values (0 to maxDrag)
    x = Math.max(0, Math.min(x, maxDrag.current));
    setDragX(x);
  }, []);

  const handleDragStart = (clientX: number) => {
    if (state === "success") return;
    isDragging.current = true;
    setState("dragging");
    updatePosition(clientX);
  };

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging.current || state === "success") return;
    updatePosition(clientX);
  }, [state, updatePosition]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current || state === "success") return;
    isDragging.current = false;

    // Calcul du pourcentage parcouru
    const progress = maxDrag.current > 0 ? dragX / maxDrag.current : 0;

    if (progress >= SUCCESS_THRESHOLD) {
      // SUCCESS
      setDragX(maxDrag.current);
      setState("success");
      vibrate([50]); // Haptic feedback sec
      setTimeout(onSuccess, 600); // Délai pour laisser l'animation de succès se jouer
    } else {
      // RESET (Retour élastique)
      setDragX(0);
      setState("idle");
    }
  }, [dragX, state, onSuccess]);

  /* -----------------------------
     EVENT LISTENERS GLOBAUX
     (Pour ne pas perdre le drag si la souris sort du bouton)
  ------------------------------*/
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const onMouseUp = () => handleDragEnd();
    const onTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX);
    const onTouchEnd = () => handleDragEnd();

    if (state === 'dragging') {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [state, handleDragMove, handleDragEnd]);

  /* -----------------------------
     ACCESSIBILITÉ (Clavier)
  ------------------------------*/
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (state === "success") return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setDragX(maxDrag.current);
      setState("success");
      vibrate([50]);
      setTimeout(onSuccess, 600);
    }
  };

  /* -----------------------------
     VISUAL CALCULATIONS
  ------------------------------*/
  const progressRatio = maxDrag.current > 0 ? dragX / maxDrag.current : 0;
  const textOpacity = Math.max(0, 1 - progressRatio * 1.5);
  const greenWidth = state === "success" 
    ? `calc(100% - ${PADDING * 2}px)` 
    : Math.max(KNOB_SIZE, dragX + KNOB_SIZE); // Le vert suit le knob

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-full select-none touch-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 ${className}`}
      style={{ height: HEIGHT }}
      onMouseDown={(e) => handleDragStart(e.clientX)}
      onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
      onKeyDown={handleKeyDown}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progressRatio * 100)}
      aria-label={text}
      tabIndex={state === "success" ? -1 : 0}
    >
      {/* 1. TRACK (Fond creusé) */}
      <div className="absolute inset-0 bg-surface-light rounded-full transition-colors duration-300" />

      {/* 2. TEXTE (Label) */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300"
        style={{ opacity: state === "success" ? 0 : textOpacity }}
      >
        <span className="text-[11px] font-bold tracking-[0.2em] text-secondary/60 uppercase animate-pulse-slow">
          {text}
        </span>
      </div>

      {/* 3. PROGRESS BAR (Verte) */}
      <div
        className="absolute rounded-full transition-all duration-75 ease-linear"
        style={{
          left: PADDING,
          top: PADDING,
          bottom: PADDING,
          width: greenWidth,
          backgroundColor: '#0e8c5b', // Accent STRYV lab
          opacity: progressRatio > 0.05 ? 1 : 0,
          transition: state === 'idle' ? 'width 0.3s ease-out, opacity 0.3s' : 'none' // Retour fluide si relâché
        }}
      >
        {/* Glow effect inside bar */}
        <div className="absolute inset-0 bg-white/20 blur-sm rounded-full" />
      </div>

      {/* 4. KNOB (Bouton physique) */}
      <div
        className={`
          absolute top-0 z-20 flex items-center justify-center rounded-full
          bg-surface border border-white/10
          transition-transform duration-75 ease-linear
          will-change-transform
        `}
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          top: PADDING,
          left: PADDING,
          transform: `translateX(${dragX}px)`,
          transition: state === 'idle' ? 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none' // Effet ressort au retour
        }}
      >
        {state === "success" ? (
          <Check size={24} className="text-accent animate-in zoom-in duration-300" strokeWidth={3} />
        ) : (
          <ChevronRight 
            size={24} 
            className="text-secondary" 
            strokeWidth={2}
          />
        )}
      </div>
    </div>
  );
}