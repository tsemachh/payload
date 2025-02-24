"use client"

import { motion } from "framer-motion"

const dotVariants = {
  start: (i: number) => ({
    x: (i % 2 === 0 ? -1 : 1) * 20,
    y: (i < 2 ? -1 : 1) * 20,
    opacity: 0,
  }),
  end: (i: number) => ({
    x: i % 2 === 0 ? 0 : "calc(100% - 1rem)",
    y: i < 2 ? 0 : "calc(100% - 1rem)",
    opacity: 1,
  }),
}

export default function LoadingSpinnerDynamic() {
  return (
    <div className="relative size-16">
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute size-4 rounded-full ${i === 3 ? "bg-[#1a237e]" : "bg-[#9fa8da]"}`}
          variants={dotVariants}
          initial="start"
          animate="end"
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: i * 0.1,
          }}
          custom={i}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  )
}

