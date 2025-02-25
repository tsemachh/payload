import type React from 'react'

export function TrueIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="12" cy="12" r="10" stroke="black" strokeWidth="2" fill="none" />
      <path
        d="M7 12.5L10.5 16L17 9"
        stroke="#22C55E"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FalseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="12" cy="12" r="10" stroke="black" strokeWidth="2" fill="none" />
      <path
        d="M8 8L16 16M8 16L16 8"
        stroke="#EF4444"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
