'use client'

import { motion } from 'framer-motion'

export default function LoadingSpinnerAlt() {
  return (
    <div className="relative size-12">
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute size-4 rounded-full ${i === 3 ? 'bg-[#1a237e]' : 'bg-[#9fa8da]'}`}
          initial={{ scale: 1 }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.8, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
          style={{
            left: i % 2 === 0 ? 0 : 'calc(100% - 1rem)',
            top: i < 2 ? 0 : 'calc(100% - 1rem)',
          }}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  )
}
