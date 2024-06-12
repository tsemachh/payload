import type { User } from 'payload/bundle'
import type { Data, Field as FieldSchema } from 'payload/bundle'

import { iterateFields } from './iterateFields.js'

type Args = {
  data: Data
  fields: FieldSchema[]
  id?: number | string
  locale: string | undefined
  siblingData: Data
  user: User
}

export const calculateDefaultValues = async ({
  id,
  data,
  fields,
  locale,
  user,
}: Args): Promise<Data> => {
  await iterateFields({
    id,
    data,
    fields,
    locale,
    siblingData: data,
    user,
  })

  return data
}
