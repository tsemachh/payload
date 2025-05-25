'use client'
import React, { useEffect, useState, useRef } from 'react'
import { useInViewport } from 'react-in-viewport'

interface ReadStatusFieldProps {
  cellData: boolean
  rowData: {
    id: string
    readStatus: boolean
  }
}

const ReadStatusField: React.FC<ReadStatusFieldProps> = ({ cellData, rowData }) => {
  const [status, setStatus] = useState(cellData)
  const myRef = useRef(null)
  const { inViewport } = useInViewport(myRef)

  useEffect(() => {
    if (inViewport && !status) {
      fetch(`/api/admin-notifications/${rowData.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          readStatus: true,
        }),
      })
        .then(() => {
          setStatus(true)
        })
        .catch(console.error)
    }
  }, [inViewport, rowData.id, status])

  return (
    <div ref={myRef}>
      <code className="bool-cell">
        <span>{String(status)}</span>
      </code>
    </div>
  )
}

export default ReadStatusField
