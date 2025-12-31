'use client'

import { Button } from '@/components/ui/button'
import { FileCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CustomSuccessPopupProps {
  isOpen: boolean
  onCloseAction: () => void
  updatedCount?: number
  companyNames?: string[]
  isPrivateVote?: boolean
}

export function PublishSuccessPopup({
  isOpen,
  onCloseAction,
  updatedCount,
  companyNames = [],
  isPrivateVote = false,
}: CustomSuccessPopupProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onCloseAction()
    }, 300) // Wait for animation to complete
  }

  const customStyle = `
  @keyframes gentle-move {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-3px); }
  }
`

  if (!isOpen) return null

  // Generate the success message based on the type of vote
  const getSuccessMessage = () => {
    if (isPrivateVote) {
      return 'נשלחה הצבעה עבור חברה אחת'
    }

    if (updatedCount !== undefined) {
      if (updatedCount === 0) {
        return 'אין שינויים חדשים לשליחה'
      }
      if (updatedCount === 1) {
        return 'נשלחה הצבעה עבור חברה אחת'
      }
      return `נשלחו הצבעות עבור ${updatedCount} חברות`
    }

    return 'ההצבעה נשלחה בהצלחה למערכת'
  }

  return (
    <>
      <style>{customStyle}</style>
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 ${isVisible ? 'bg-black/20' : 'bg-black/0'}`}
        style={{ backdropFilter: 'blur(2px)' }}
      >
        <div className="flex items-center justify-center min-h-screen p-4">
          <div
            className={`relative transition-all duration-500 ease-out transform ${
              isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.8) 100%)',
              borderRadius: '12px',
              padding: '32px 24px',
              minWidth: '300px',
              maxWidth: '480px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Hand icon */}
            <div className="flex items-center justify-center mb-6">
              <div
                className="text-6xl mb-4 animate-pulse"
                style={{
                  animation: 'gentle-move 2s ease-in-out infinite',
                }}
              >
                <FileCheck className="h-20 w-20 text-green-600" />
              </div>
            </div>

            {/* Success message */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-medium text-foreground leading-relaxed">
                {getSuccessMessage()}
              </h2>

              {/* Show company names if there are any */}
              {companyNames.length > 0 && (
                <div className="mt-4 text-sm text-muted-foreground">
                  <ul className="text-right list-none">
                    {companyNames.map((name, index) => (
                      <li key={index} className="mb-1">
                        • {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm button */}
            <div className="text-center">
              <Button
                onClick={handleClose}
                className="w-full font-medium py-2.5 px-6 text-base"
                size="lg"
              >
                אישור
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
