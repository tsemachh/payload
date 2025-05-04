import { PayloadRequest } from 'payload'

const validateQueryParams = (accountId: string, companyId: string) => {
  if (!companyId || typeof companyId !== 'string') {
    return Response.json({ error: 'Missing or invalid companyId' }, { status: 400 })
  }
  if (!accountId || typeof accountId !== 'string') {
    return Response.json({ error: 'Missing or invalid accountId' }, { status: 400 })
  }
  return null
}

export const getParentAccountId = async (
  companyId: number,
  req: PayloadRequest
): Promise<number | null> => {
  const result = await req.payload.find({
    collection: 'companies',
    where: {
      companyId: {
        equals: companyId,
      },
    },
    depth: 1, // חשוב: כדי לקבל גם את accounts אם זה relation
    limit: 1,
  })

  console.log('----result', result)

  const companyDoc = result.docs[0]

  if (!companyDoc || !companyDoc.accounts || !Array.isArray(companyDoc.accounts)) {
    return null
  }

  console.log('companyDoc.accounts', companyDoc.accounts)

  const [firstAccount] = companyDoc.accounts
  const accountId = typeof firstAccount === 'object' ? firstAccount.id : firstAccount

  return typeof accountId === 'number' ? accountId : null
}

const addSubAccountEndPoint = async (req: PayloadRequest) => {
  try {
    console.log('-----aaa')

    const { accountId, companyId } = req.query as { accountId: string; companyId: string }

    const queryParamError = validateQueryParams(accountId, companyId)
    console.log('-----queryParamError', queryParamError)

    if (queryParamError) return queryParamError
    console.log('-----accountId', accountId)
    console.log('-----companyId', companyId)


    const numericCompanyId = Number(companyId)
    console.log('-----numericCompanyId', numericCompanyId)

    if (isNaN(numericCompanyId)) {
      return Response.json({ error: 'Invalid companyId format' }, { status: 400 })
    }

    const parentAccountId = await getParentAccountId(numericCompanyId, req)

    console.log('-----accountId', accountId)
    console.log('-----companyId', numericCompanyId)
    console.log('-----parentAccountId', parentAccountId)

    return Response.json({ message: 'OK', parentAccountId }, { status: 200 })
  } catch (error) {
    console.error('Error processing addSubAccount:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export default addSubAccountEndPoint
