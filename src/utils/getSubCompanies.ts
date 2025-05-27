import { stringify } from 'qs-esm'
import type { PayloadRequest } from 'payload'

type GetSubtreeOptions =
  | { ids: string[]; req: PayloadRequest } // צד שרת
  | { ids: string[] } // צד לקוח

export async function getSubtreeExcludingLeaves(options: GetSubtreeOptions): Promise<Set<string>> {
  const ids = options.ids
  const validIds = new Set<string>()

  try {
    let results: any

    if ('req' in options) {
      // צד שרת
      results = await options.req.payload.find({
        collection: 'companies',
        where: {
          id: { in: ids },
        },
        select: {
          companyId: true,
          subCompanies: true,
          'subCompanies.id': true,
          'subCompanies.subCompanies': true,
          'subCompanies.subCompanies.subCompanies': true,
          'subCompanies.subCompanies.subCompanies.subCompanies': true,
        },
        populate: {
          companies: { subCompanies: true },
        },
        depth: 4,
        limit: 0,
      })
    } else {
      // צד לקוח
      const query = {
        where: {
          id: { in: ids },
        },
        select: {
          companyId: true,
          subCompanies: true,
          'subCompanies.id': true,
          'subCompanies.subCompanies': true,
          'subCompanies.subCompanies.subCompanies': true,
          'subCompanies.subCompanies.subCompanies.subCompanies': true,
        },
        populate: {
          companies: { subCompanies: true },
        },
        depth: 4,
        limit: 0,
      }
      const stringified = stringify(query, { addQueryPrefix: true })
      const response = await fetch(`/api/companies${stringified}`)

      if (!response.ok) {
        console.error(`Failed to fetch companies: ${response.status}`)
        return validIds
      }

      results = await response.json()
    }

    const traverseExcludingLeaves = (node: any) => {
      const children = node.subCompanies?.docs ?? node.subCompanies
      if (!children?.length) return
      validIds.add(node.id)
      children.forEach(traverseExcludingLeaves)
    }

    for (const doc of results.docs) {
      const children = doc.subCompanies?.docs ?? doc.subCompanies
      if (!children?.length) {
        validIds.add(doc.id)
      } else {
        traverseExcludingLeaves(doc)
      }
    }
  } catch (error) {
    console.error('Error in getSubtreeExcludingLeaves:', error)
  }

  return validIds
}
