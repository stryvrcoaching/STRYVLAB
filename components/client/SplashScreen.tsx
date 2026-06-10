"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

// 2× half-turn spin: 0→180 (pause) →360, zoom pulse on second half
const SPIN_MS  = 1800
const HOLD_MS  = 350
const FADE_MS  = 450
const TOTAL_MS = SPIN_MS + HOLD_MS + FADE_MS

// Keyframe time offsets (0–1) inside SPIN_MS
const T_HALF    = 0.40  // 0° → 180° ends
const T_RESUME  = 0.44  // pause ends, second half starts
const T_ZOOM_PK = 0.72  // scale peak

export default function SplashScreen() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem("stryvr_splash_seen")) return
    sessionStorage.setItem("stryvr_splash_seen", "1")
    setVisible(true)
    const t = setTimeout(() => setVisible(false), TOTAL_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#0d0d0d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: FADE_MS / 1000, ease: "easeInOut" } }}
        >
          <motion.div
            animate={{
              rotate: [0, 180, 180, 360],
              scale:  [1, 1,   1.11, 1],
            }}
            transition={{
              rotate: {
                duration: SPIN_MS / 1000,
                times: [0, T_HALF, T_RESUME, 1],
                // each half: fast start → decelerate into rest (easeOut feel)
                ease: ["easeOut", "linear", "easeOut"],
              },
              scale: {
                duration: SPIN_MS / 1000,
                times: [0, T_RESUME, T_ZOOM_PK, 1],
                ease: ["linear", "easeOut", "easeIn"],
              },
            }}
          >
            <Image
              src="/logo/Logo STRYVR.svg"
              alt="STRYVR"
              width={88}
              height={88}
              priority
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
