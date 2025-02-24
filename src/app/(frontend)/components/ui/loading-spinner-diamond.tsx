"use client"

import { motion } from "framer-motion"

const dotPositions = [
  { x: 0, y: -19 }, // Top
  { x: -16, y: -9.5 }, // Left
  { x: 16, y: -9.5 }, // Right
]

export default function LoadingSpinnerDiamond() {
  return (
    <div className="relative size-20">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45">
        {/* Dark dot (always visible) */}
        <div
          className="absolute size-4 rounded-full bg-[#1a237e]"
          style={{
            bottom: "2px",
            left: "calc(50% - 0.5rem)",
          }}
        />

        {/* Light dots */}
        {dotPositions.map((position, index) => (
          <motion.div
            key={index}
            className="absolute size-4 rounded-full bg-[#9fa8da]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: index * 0.5,
              ease: "easeInOut",
            }}
            style={{
              bottom: "2px",
              left: "calc(50% - 0.5rem)",
              x: position.x,
              y: position.y,
            }}
          />
        ))}
      </div>
      <span className="sr-only">טוען...</span>
    </div>
  )
}

