'use client'

import { motion } from 'framer-motion'

export default function LoadingSpinner() {
  return (
    <div className="relative size-12">
      <motion.div
        className="absolute size-full"
        animate={{ rotate: 360 }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'linear',
        }}
      >
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`absolute size-4 rounded-full ${i === 3 ? 'bg-[#1a237e]' : 'bg-[#9fa8da]'}`}
            style={{
              left: i % 2 === 0 ? 0 : 'calc(100% - 1rem)',
              top: i < 2 ? 0 : 'calc(100% - 1rem)',
            }}
          />
        ))}
      </motion.div>
      <span className="sr-only">Loading...</span>
    </div>
  )
}
