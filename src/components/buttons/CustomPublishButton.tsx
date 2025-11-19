'use client'

import React, { useCallback, useState } from 'react'
import {
  ConfirmationModal,
  FormSubmit,
  useDocumentInfo,
  useForm,
  useFormModified,
  useModal,
  useTranslation,
} from '@payloadcms/ui' // Import the original PublishButton // Use Payload's useModal wrapper

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
  const meetingDate = data?.meetingDate ? new Date(data.meetingDate) : null

  const [isSignificantChange, setIsSignificantChange] = useState(false)
  const [changeDetails, setChangeDetails] = useState('')
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
  }, [uploadStatus, isSignificantChange, submit, changeDetails, setUnpublishedVersionCount, setMostRecentVersionIsAutosaved, setHasPublishedDoc])

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
  }, [toggleModal, collectionSlug, data, handlePublish, id, meetingDate])

  // Handle significant change confirmation
  const handleSignificantChangeConfirm = useCallback(
    (isSignificant: boolean, details: string = '') => {
      setIsSignificantChange(isSignificant)
      setChangeDetails(details)
      handlePublish()
    },
    [handlePublish, setChangeDetails],
  )

  if (!hasPublishPermission) {
    return null
  }
  const hasNewerVersions = unpublishedVersionCount > 0

  return (
    <React.Fragment>
      <FormSubmit
        buttonId="action-save"
        disabled={
          hasPublishPermission &&
          (modified || hasNewerVersions || !hasPublishedDoc) &&
          uploadStatus === 'uploading'
        }
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
                <label htmlFor="changeDetails" style={{ display: 'block', marginBottom: '5px' }}>
                  תיאור השינויים:
                </label>
                <textarea
                  id="changeDetails"
                  value={changeDetails}
                  onChange={(e) => setChangeDetails(e.target.value)}
                  style={{ width: '100%', minHeight: '100px', padding: '8px' }}
                  placeholder="תאר את השינויים שבוצעו באסיפה..."
                />
              </div>
            </React.Fragment>
          }
          modalSlug={significantChangeModalSlug}
          onConfirm={() => handleSignificantChangeConfirm(true, changeDetails)}
          onCancel={() => handleSignificantChangeConfirm(false, undefined)}
          confirmingLabel={'כן'}
          cancelLabel={'לא'}
        />
      )}
    </React.Fragment>
  )
}

export default CustomPublishButton
