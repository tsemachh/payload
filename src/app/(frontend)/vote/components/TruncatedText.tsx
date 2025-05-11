"use client"

import { useRef, useState, useEffect } from "react"

interface TruncatedTextProps {
  text: string
  className?: string
}

export default function TruncatedText({ text, className = "" }: TruncatedTextProps) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    const checkTruncation = () => {
      const element = textRef.current
      if (element) {
        setIsTruncated(element.scrollWidth > element.clientWidth)
      }
    }

    checkTruncation()
    window.addEventListener("resize", checkTruncation)
    return () => window.removeEventListener("resize", checkTruncation)
  }, [text])

  return (
    <span ref={textRef} className={`block truncate ${className}`} title={isTruncated ? text : undefined}>
      {text}
    </span>
  )
}