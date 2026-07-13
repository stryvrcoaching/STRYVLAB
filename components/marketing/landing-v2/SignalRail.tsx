"use client";

import { motion } from "framer-motion";
import { motionTokens } from "./motion";
import { useReducedMotion } from "./useReducedMotion";

export function SignalRail({
  className = "",
  animate = false,
}: {
  className?: string;
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden="true" className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: 18 }, (_, index) => (
        <motion.span
          key={index}
          className={`h-1.5 flex-1 rounded-full ${index < 5 ? "bg-[#d96858]" : index < 11 ? "bg-[#c6b48b]" : index < 15 ? "bg-[#86aeb8]" : "bg-white/14"}`}
          initial={false}
          whileInView={
            animate && !reduced ? { opacity: 1, scaleX: 1 } : undefined
          }
          viewport={{ once: true, amount: 0.6 }}
          transition={{
            duration: motionTokens.duration.quick,
            delay: index * 0.035,
            ease: motionTokens.ease,
          }}
        />
      ))}
    </div>
  );
}
