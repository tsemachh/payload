import { PayloadRequest } from 'payload'

const validateQueryParams = (accountId: string, companyId: string) => {
  if (!companyId) {
    return Response.json({ error: 'Missing or invalid companyId' }, { status: 400 })
  }
  if (!accountId) {
    return Response.json({ error: 'Missing or invalid accountId' }, { status: 400 })
  }
  return null
}


const createSubAccount = async (
  req: PayloadRequest,
  accountNumber: number,
  companyId: string
) => {
  // Get the company document
  const companyResult = await req.payload.find({
    collection: 'companies',
    where: {
      id: {
        equals: companyId,
      },
    },
    depth: 0,
    limit: 1,
  })

  if (companyResult.docs.length === 0) {
    throw new Error(`Company not found with ID: ${companyId}`)
  }

  const company = companyResult.docs[0]
  const mainAccount = company.mainAccount || []

  if (mainAccount.length === 0) {
    throw new Error(`No Account was found for company: ${companyId}`)
  }

  // Find the mainAccount entry with the matching accountNumber (parent account)
  const parentAccountIndex = 0

  // Add the new sub-account to the subAccounts array of that mainAccount entry
  const subAccounts = mainAccount[parentAccountIndex].subAccounts || []
  const accountNumberStr = accountNumber.toString()

  // Check if the sub-account already exists
  if (!subAccounts.includes(accountNumberStr)) {
    subAccounts.push(accountNumberStr)
    mainAccount[parentAccountIndex].subAccounts = subAccounts

    // Update the company document
    return await req.payload.update({
      collection: 'companies',
      id: companyId,
      data: {
        mainAccount,
      },
    })
  }

  return company
}


const addSubAccountEndPoint = async (req: PayloadRequest) => {
  try {
    const { companyId } = req.query as { companyId: string }

    // @ts-expect-error req not null
    const account = await req.json()
    const accountId = account.accountId

    const queryParamError = validateQueryParams(accountId, companyId)

    if (queryParamError) return queryParamError

    await createSubAccount(req, Number(accountId), companyId)

    return Response.json({ message: 'OK'  }, { status: 200 })
  } catch (error) {
    console.error('Error processing addSubAccount:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export default addSubAccountEndPoint
