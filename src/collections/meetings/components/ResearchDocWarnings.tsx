'use client'

import React, { useEffect, useState } from 'react'

interface WarningModalProps {
  warnings: string[]
  onConfirm: () => void
  onCancel: () => void
}

const WarningModal: React.FC<WarningModalProps> = ({ warnings, onConfirm, onCancel }) => {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '20px',
          borderBottom: '1px solid #e5e5e5',
          paddingBottom: '16px'
        }}>
          <h3 style={{ 
            margin: 0, 
            color: '#d97706',
            fontSize: '18px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ⚠️ אזהרות מסמכי מחקר
          </h3>
        </div>

        {/* Warnings List */}
        <div style={{ marginBottom: '20px' }}>
          {warnings.map((warning, index) => (
            <div 
              key={index}
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fed7aa',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: index < warnings.length - 1 ? '12px' : '0',
                fontSize: '14px',
                whiteSpace: 'pre-line',
                lineHeight: '1.5'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}>
                <span style={{
                  color: '#d97706',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>
                  ⚠️
                </span>
                <div style={{
                  color: '#92400e',
                  flex: 1
                }}>
                  {warning}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Question */}
        <div style={{ 
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '20px',
          fontSize: '14px',
          color: '#0c4a6e',
          textAlign: 'center',
          fontWeight: '500'
        }}>
          האם ברצונך להמשיך בשמירה למרות האזהרות?
        </div>

        {/* Actions */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          gap: '12px'
        }}>
          <button
            onClick={onCancel}
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
          >
            ביטול
          </button>
          <button
            onClick={onConfirm}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            המשך בשמירה
          </button>
        </div>
      </div>
    </div>
  )
}

// Global function to show warning modal
declare global {
  interface Window {
    showResearchWarningModal: (warnings: string[]) => Promise<boolean>
  }
}

// Initialize the warning modal system
const initializeWarningModal = () => {
  if (typeof window === 'undefined') return

  window.showResearchWarningModal = (warnings: string[]): Promise<boolean> => {
    return new Promise((resolve) => {
      const modalContainer = document.createElement('div')
      document.body.appendChild(modalContainer)

      const handleConfirm = () => {
        document.body.removeChild(modalContainer)
        resolve(true)
      }

      const handleCancel = () => {
        document.body.removeChild(modalContainer)
        resolve(false)
      }

      // Render the modal
      const React = require('react')
      const ReactDOM = require('react-dom')
      
      ReactDOM.render(
        React.createElement(WarningModal, {
          warnings,
          onConfirm: handleConfirm,
          onCancel: handleCancel
        }),
        modalContainer
      )
    })
  }

  // Intercept form submissions to check for warnings
  const originalSubmit = HTMLFormElement.prototype.submit
  HTMLFormElement.prototype.submit = function() {
    // Check if this is a meeting form
    const formData = new FormData(this)
    const hasResearchDocs = formData.get('researchDocuments')
    
    if (hasResearchDocs) {
      // This will be handled by the validation hook
    }
    
    return originalSubmit.call(this)
  }
}

const ResearchDocWarnings: React.FC = () => {
  useEffect(() => {
    initializeWarningModal()
  }, [])

  return null // This component doesn't render anything visible
}

export default ResearchDocWarnings