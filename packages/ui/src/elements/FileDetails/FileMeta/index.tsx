import { formatFilesize } from 'payload/utilities'
import React, { useState } from 'react'

import type { Props } from './types.d.ts'

import { Edit } from '../../../icons/Edit/index.js'
import CopyToClipboard from '../../CopyToClipboard/index.js'
import { useDocumentDrawer } from '../../DocumentDrawer/index.js'
import { Tooltip } from '../../Tooltip/index.js'
import './index.scss'

const baseClass = 'file-meta'

const FileMeta: React.FC<Props> = (props) => {
  const { id, collection, filename, filesize, height, mimeType, url: fileURL, width } = props

  const [hovered, setHovered] = useState(false)
  const openInDrawer = Boolean(id && collection)

  const [DocumentDrawer, DocumentDrawerToggler] = useDocumentDrawer({
    id,
    collectionSlug: collection,
  })

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__url`}>
        {openInDrawer && <DocumentDrawer />}
        <a href={fileURL} rel="noopener noreferrer" target="_blank">
          {filename}
        </a>
        <CopyToClipboard defaultMessage="Copy URL" value={fileURL} />
        {openInDrawer && (
          <DocumentDrawerToggler
            className={`${baseClass}__edit`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <Edit />
            <Tooltip show={hovered}>Edit</Tooltip>
          </DocumentDrawerToggler>
        )}
      </div>
      <div className={`${baseClass}__size-type`}>
        {formatFilesize(filesize)}
        {width && height && (
          <React.Fragment>
            &nbsp;-&nbsp;
            {width}x{height}
          </React.Fragment>
        )}
        {mimeType && (
          <React.Fragment>
            &nbsp;-&nbsp;
            {mimeType}
          </React.Fragment>
        )}
      </div>
    </div>
  )
}

export default FileMeta