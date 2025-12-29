'use client'

import type React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Modal, useModal, useSelection } from '@payloadcms/ui'

const ProcessCompaniesMeetingsMenuItem: React.FC = () => {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const modalSlug = 'process-companies-result-modal'
  const { openModal, closeModal } = useModal()
  const { getSelectedIds } = useSelection()

  const handleClick = async () => {
    try {
      setBusy(true)
      const body: any = {}
      // If specific rows are selected, narrow to those IDs
      const selectedIds = getSelectedIds()
      if (Array.isArray(selectedIds) && selectedIds.length > 0) {
        body.selectedIds = selectedIds
      }

      const res = await fetch('/api/meetings/process-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'failed')
      }
      const data = await res.json().catch(() => ({}))
      setResult(data)
      openModal(modalSlug)
      toast.success('הצלבה הושלמה')
    } catch (e: any) {
      console.error(e)
      toast.error('שגיאה בהרצת הצלבה', { description: e?.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={busy}
        style={{
          background: 'none',
          border: 'none',
          margin: 0,
          color: 'inherit',
          font: 'inherit',
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? 'מריץ חישוב זכאות לאסיפה…' : 'חישוב זכאות לאסיפה'}
      </button>

      <Modal
        slug={modalSlug}
        className="payload__modal"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(2px)',
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            padding: 16,
            maxWidth: 640,
            width: '90vw',
            background: '#fff',
            color: '#111',
            borderRadius: 8,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>תוצאות הצלבה</h3>
          {result ? (
            <div style={{ whiteSpace: 'pre-wrap', direction: 'rtl' }}>
              <p>בוצע בהצלחה: {String(result.success)}</p>
              <p>
                מספר אסיפות שעובדו: {String(result.processed)} | זמן ריצה: {result.durationMs}
                ms
              </p>
              {result.message && <p>הודעה: {result.message}</p>}
            </div>
          ) : (
            <p>אין נתונים להצגה.</p>
          )}
          <div style={{ marginTop: 16, textAlign: 'end' }}>
            <button onClick={() => closeModal(modalSlug)}>סגור</button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default ProcessCompaniesMeetingsMenuItem
