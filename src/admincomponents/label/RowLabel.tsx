'use client'
import { useRowLabel, useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

const RowLabel: React.FC = () => {
  const { data, rowNumber } = useRowLabel<{ agendaTexts: any }>()
  const agendaTexts = useFormFields(([fields, dispatch]) => fields.agendaTexts)

  const [label, setLabel] = useState(`Variant ${rowNumber}`)

  useEffect(() => {
    console.log('RowLabel data', data)
    console.log('-==agendaTexts ', agendaTexts)

    if (agendaTexts) {
      console.log('!!!agendaTexts', agendaTexts)

      // Assuming data.header contains the title you want to use
      setLabel(typeof agendaTexts?.value === 'string' ? agendaTexts.value : `Section ${rowNumber}`) //api to meeting סדק יום נושאים לפי המספר..
    } else {
      // Default label if header is not present
      setLabel(`Section ${rowNumber}`)
    }
  }, [data, rowNumber])

  return (
    <div>
      <span>{label}</span>
    </div>
  )
}
export default RowLabel
