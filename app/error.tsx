'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#EDF3F7] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-6"
      >
        <h1 className="text-4xl font-heading font-extralight text-[#0F2334] mb-4">
          Une erreur est survenue
        </h1>
        <p className="text-lg font-sans font-normal text-[#2D5168] mb-8">
          {error.message || 'Une erreur inattendue s\'est produite.'}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#19D4FF] text-white rounded-button font-sans font-normal hover:bg-[#0FA8CC] transition-colors"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="px-6 py-3 bg-[#0F2334] text-white rounded-button font-sans font-normal hover:bg-[#1a2f42] transition-colors"
          >
            Retour à l'accueil
          </Link>
        </div>
      </motion.div>
    </div>
  )
}







