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
  companyId: string,
  req: PayloadRequest
): Promise<string | null> => {
  const result = await req.payload.find({
    collection: 'companies',
    where: {
      id: {
        equals: companyId,
      },
    },
    depth: 0,
    limit: 1,
  })


  const companyDoc = result.docs[0]

  if (
    !companyDoc ||
    !companyDoc.accounts ||
    !companyDoc.accounts.docs ||
    !Array.isArray(companyDoc.accounts.docs) ||
    companyDoc.accounts.docs.length === 0
  ) {
    return null
  }

  const parentAccountId = companyDoc.accounts.docs[0]
  return typeof parentAccountId === 'string' ? parentAccountId : null

}


const createSubAccount = async (
  req: PayloadRequest,
  accountNumber: number,
  parentAccount: string | null,
  company: string
) => {
  return await req.payload.create({
    collection: 'accounts',
    data: {
      accountNumber,
      name: `Sub Account ${accountNumber}`,
      company,
      isCentralAccount: false,
      parentAccount,
    },
  })
}


const addSubAccountEndPoint = async (req: PayloadRequest) => {
  try {
    const { companyId } = req.query as { companyId: string }

    // @ts-expect-error req not null
    const account = await req.json()
    const accountId=account.accountId

    const queryParamError = validateQueryParams(accountId, companyId)

    if (queryParamError) return queryParamError

    const parentAccountId = await getParentAccountId(companyId, req)

    await createSubAccount(req, Number(accountId), parentAccountId, companyId)

    return Response.json({ message: 'OK', parentAccountId }, { status: 200 })
  } catch (error) {
    console.error('Error processing addSubAccount:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export default addSubAccountEndPoint
