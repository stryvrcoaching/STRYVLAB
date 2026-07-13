import type { Variants } from "framer-motion";
export const motionTokens = {
  duration: { quick: 0.32, base: 0.52, scene: 0.78 },
  stagger: 0.1,
  distance: 18,
  ease: [0.22, 1, 0.36, 1] as const,
};
export const revealUp: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: motionTokens.duration.base,
      ease: motionTokens.ease,
    },
  },
};
export const revealScale: Variants = {
  hidden: { opacity: 0, scale: 0.975 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: motionTokens.duration.scene,
      ease: motionTokens.ease,
    },
  },
};
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: motionTokens.stagger, delayChildren: 0.06 },
  },
};
export const onceViewport = { once: true, amount: 0.24 } as const;
