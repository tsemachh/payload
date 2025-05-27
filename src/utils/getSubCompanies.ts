import { stringify } from 'qs-esm'

export async function getSubtreeExcludingLeaves(userAddedIds: string[]): Promise<Set<string>> {
  const validIds = new Set<string>()
  //   console.log('----==== userAddedIds', userAddedIds)

  try {
    const query = {
      where: {
        id: {
          in: userAddedIds,
        },
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
        companies: {
          subCompanies: true,
        },
      },
      depth: 4,
      limit: 0,
    }

    // console.log('----==== query', query)

    const stringified = stringify(query, { addQueryPrefix: true })
    const response = await fetch(`/api/companies${stringified}`)
    // console.log('----==== response', response)

    if (!response.ok) {
      console.error(`Failed to fetch companies: ${response.status}`)
      return validIds
    }

    const results = await response.json()
    // console.log('----==== results', results)

    function traverseExcludingLeaves(node: any) {
      const children = node.subCompanies?.docs ?? node.subCompanies
      if (!children?.length) {
        // It's a leaf – skip!
        return
      }
      // It's a non-leaf – include it
      validIds.add(node.id)
      children.forEach(traverseExcludingLeaves)
    }

    for (const doc of results.docs) {
      const children = doc.subCompanies?.docs ?? doc.subCompanies
      if (!children?.length) {
        // Original node is a leaf → include it
        validIds.add(doc.id)
      } else {
        // Original node is a tree → process recursively, excluding leaves
        traverseExcludingLeaves(doc)
      }
    }
  } catch (error) {
    console.error('Error in getSubtreeExcludingLeaves:', error)
  }
  //   console.log('----==== validIds', validIds)

  return validIds
}
