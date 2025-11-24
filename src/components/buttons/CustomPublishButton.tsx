'use client'

import React, { useCallback, useMemo, useState } from 'react'
import {
  ConfirmationModal,
  FormSubmit,
  useDocumentInfo,
  useForm,
  useFormModified,
  useModal,
  useTranslation,
  toast,
} from '@payloadcms/ui'

export const CustomPublishButton: React.FC = () => {
  const {
    hasPublishPermission,
    setHasPublishedDoc,
    uploadStatus,
    collectionSlug,
    data,
    hasPublishedDoc,
    id,
    unpublishedVersionCount,
    setUnpublishedVersionCount,
    setMostRecentVersionIsAutosaved,
  } = useDocumentInfo()
  // Use data from useDocumentInfo instead of useField to avoid marking form as modified
  const meetingDate = useMemo(
    () => (data?.meetingDate ? new Date(data.meetingDate) : null),
    [data?.meetingDate],
  )

  const [isSignificantChange, setIsSignificantChange] = useState(false)
  const [changeDetails, setChangeDetails] = useState('')
  const [hasError, setHasError] = useState(false)
  const { submit } = useForm()
  const modified = useFormModified()
  const { t } = useTranslation()
  const { isModalOpen, toggleModal } = useModal()

  const significantChangeModalSlug = 'significant-change-modal'

  // Simple publish function
  const handlePublish = useCallback(async () => {
    if (uploadStatus === 'uploading') {
      return
    }

    // If this is a meeting and it's a significant change, log a message
    if (isSignificantChange) {
      console.log('Significant change detected in meeting. Participants should be notified.')
    }

    const result = await submit({
      overrides: {
        _status: 'published',
        changeDetails: changeDetails || null,
      },
    })
    if (result) {
      setUnpublishedVersionCount(0)
      setMostRecentVersionIsAutosaved(false)
      setHasPublishedDoc(true)
    }
  }, [
    uploadStatus,
    isSignificantChange,
    submit,
    changeDetails,
    setUnpublishedVersionCount,
    setMostRecentVersionIsAutosaved,
    setHasPublishedDoc,
  ])

  // Open confirmation modal
  const openConfirmModal = useCallback(() => {
    // If this is not a meeting collection or it's a new document, publish directly
    if (collectionSlug !== 'meetings' || !id) {
      handlePublish()
      return
    }
    // If the document has never been published before, skip the modal and publish immediately
    if (!hasPublishedDoc) {
      handlePublish()
      return
    }

    // If this is a meeting collection with existing data
    if (data) {
      const now = new Date()

      // If it's a future meeting, ask if it's a significant change
      if (meetingDate && meetingDate > now) {
        toggleModal(significantChangeModalSlug)
        return
      } else {
        // For past meetings or meetings without a date
        handlePublish()
      }
    } else {
      // Fallback for any other case
      handlePublish()
    }
  }, [toggleModal, collectionSlug, data, handlePublish, id, meetingDate, hasPublishedDoc])

  // Handle significant change confirmation
  const handleSignificantChangeConfirm = useCallback(
    async (isSignificant: boolean, details: string = '') => {
      // If user confirmed it's a significant change but didn't provide details, show alert
      if (isSignificant && !details.trim()) {
        setHasError(true)
        toast.error('יש למלא תיאור השינויים כאשר מדובר בשינוי מהותי')
        return
      }

      setHasError(false)
      setIsSignificantChange(isSignificant)
      setChangeDetails(details)

      await handlePublish()

      setChangeDetails('')
    },
    [handlePublish],
  )

  if (!hasPublishPermission) {
    return null
  }
  const hasNewerVersions = unpublishedVersionCount > 0

  const canPublish =
    hasPublishPermission &&
    uploadStatus !== 'uploading' &&
    (modified || hasNewerVersions || !hasPublishedDoc)

  return (
    <React.Fragment>
      <FormSubmit
        buttonId="action-save"
        disabled={!canPublish}
        onClick={openConfirmModal}
        size="medium"
        type="button"
      >
        {t('version:publishChanges')}
      </FormSubmit>

      {isModalOpen(significantChangeModalSlug) && (
        <ConfirmationModal
          heading="פרסום שינויים עבור האסיפה"
          body={
            <React.Fragment>
              <div>האם השינויים שביצעת באסיפה הם מהותיים ודורשים יידוע של המשתתפים?</div>
              <div style={{ marginTop: '15px' }}>
                <label
                  htmlFor="changeDetails"
                  style={{
                    display: 'block',
                    marginBottom: '5px',
                    color: hasError ? 'var(--theme-error-500)' : 'inherit',
                  }}
                >
                  תיאור השינויים:
                  {hasError && <span style={{ color: 'var(--theme-error-500)' }}> *</span>}
                </label>
                <textarea
                  id="changeDetails"
                  value={changeDetails}
                  onChange={(e) => {
                    setChangeDetails(e.target.value)
                    if (hasError && e.target.value.trim()) {
                      setHasError(false)
                    }
                  }}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '8px',
                    border: hasError
                      ? '1px solid var(--theme-error-500)'
                      : '1px solid var(--theme-elevation-400)',
                    borderRadius: '4px',
                    outline: hasError ? 'none' : undefined,
                  }}
                  placeholder="תאר את השינויים שבוצעו באסיפה..."
                  className={hasError ? 'error' : ''}
                />
                {hasError && (
                  <div
                    style={{
                      color: 'var(--theme-error-500)',
                      fontSize: '13px',
                      marginTop: '5px',
                    }}
                  >
                    שדה זה נדרש כאשר מדובר בשינוי מהותי
                  </div>
                )}
              </div>
            </React.Fragment>
          }
          modalSlug={significantChangeModalSlug}
          onConfirm={async () => await handleSignificantChangeConfirm(true, changeDetails)}
          onCancel={async () => {
            setHasError(false)
            await handleSignificantChangeConfirm(false, undefined)
          }}
          confirmingLabel={'כן'}
          cancelLabel={'לא'}
        />
      )}
    </React.Fragment>
  )
}

export default CustomPublishButton
