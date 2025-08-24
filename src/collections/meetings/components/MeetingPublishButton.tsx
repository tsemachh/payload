'use client'

import React, { useCallback } from 'react'
import { Modal, PublishButton, useDocumentInfo, useForm, useModal } from '@payloadcms/ui' // Import the original PublishButton // Use Payload's useModal wrapper

// You can extend the original props if needed
export const MeetingPublishButton: React.FC<any> = (props) => {
  const { toggleModal, isModalOpen, closeModal } = useModal()
  const { submit } = useForm()
  const {
    setUnpublishedVersionCount,
    setMostRecentVersionIsAutosaved,
    setHasPublishedDoc,
    uploadStatus,
  } = useDocumentInfo()

  const modalSlug = 'confirm-publish-modal'

  // Custom publish function with your logic
  const handlePublish = useCallback(() => {
    // Open confirmation modal instead of publishing directly
    toggleModal(modalSlug)
  }, [toggleModal])

  // The actual publish function to call after confirmation
  const confirmPublish = useCallback(() => {
    if (uploadStatus === 'uploading') {
      return
    }
    console.log('cusotm publiush', uploadStatus)
    // Your custom logic here before publishing
    // ...

    // Proceed with publishing
    submit({
      overrides: {
        _status: 'published',
      },
    })

    setUnpublishedVersionCount(0)
    setMostRecentVersionIsAutosaved(false)
    setHasPublishedDoc(true)

    // Close the modal
    closeModal(modalSlug)
  }, [
    submit,
    setUnpublishedVersionCount,
    setMostRecentVersionIsAutosaved,
    setHasPublishedDoc,
    uploadStatus,
    closeModal,
  ])

  return (
    <>
      {/* Render the original PublishButton but override its onClick */}
      <PublishButton {...props} onClick={handlePublish} />

      {/* Confirmation Modal */}
      {isModalOpen(modalSlug) && (
        <Modal slug={modalSlug} className="confirm-publish-modal">
          <div className="confirm-publish-content">
            <h2>Confirm Publish</h2>
            <p>Are you sure you want to publish this document?</p>

            {/* Add your custom logic/fields here */}

            <div className="confirm-publish-actions">
              <button className="btn btn--style-secondary" onClick={() => closeModal(modalSlug)}>
                Cancel
              </button>
              <button className="btn btn--style-primary" onClick={confirmPublish}>
                Confirm Publish
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

export default MeetingPublishButton
