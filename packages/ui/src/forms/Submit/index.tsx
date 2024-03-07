'use client'
import React, { forwardRef } from 'react'

import type { Props } from '../../elements/Button/types.d.ts'

import { Button } from '../../elements/Button/index.js'
import { useForm, useFormProcessing } from '../Form/context.js'
import './index.scss'

const baseClass = 'form-submit'

const FormSubmit = forwardRef<HTMLButtonElement, Props>((props, ref) => {
  const { buttonId: id, children, disabled: disabledFromProps, type = 'submit' } = props
  const processing = useFormProcessing()
  const { disabled } = useForm()
  const canSave = !(disabledFromProps || processing || disabled)

  return (
    <div className={baseClass}>
      <Button ref={ref} {...props} disabled={canSave ? undefined : true} id={id} type={type}>
        {children}
      </Button>
    </div>
  )
})

export default FormSubmit