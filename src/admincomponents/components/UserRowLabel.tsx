'use client'
import { useRowLabel, useField } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

const UserRowLabel: React.FC = () => {
  const { rowNumber } = useRowLabel()
  const { value: companyValue } = useField<any>({
    path: `companies.${rowNumber}.companyId`,
  })

  const [label, setLabel] = useState('טוען...')

  useEffect(() => {
    if (!companyValue) {
      setLabel('אין חברה')
      return
    }

    if (typeof companyValue === 'string') {
      fetch(`/api/companies/${companyValue}`)
        .then((res) => res.json())
        .then((data) => {
          setLabel(data.name || 'ללא שם')
        })
        .catch(() => setLabel('שגיאה בטעינת שם'))
    } else if (companyValue?.name) {
      setLabel(companyValue.name)
    }
  }, [companyValue])

  return <div>{label}</div>
}

export default UserRowLabel
