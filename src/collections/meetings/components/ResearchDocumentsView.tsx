'use client'

import React, { useEffect, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SingleDocumentIcon } from '@/components/ui/icons'
import { 
  Building2, 
  ChevronDown, 
  ChevronRight,
  Group,
  Ungroup
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { calculateHoldingValues } from '@/utils/dataUtils'
import { groupCompaniesByParent } from '@/utils/voteGrouping'
import { stringify } from 'qs-esm'

interface Company {
  id: string
  name: string
  parentCompany?: {
    name: string
    hasNextPage: boolean
  }
  percentageHolding?: number
  nominalValue?: number
  holdingValueInMillions?: number
  passiveFunds?: boolean
  researchDocuments?: {
    showResearchPrivate?: boolean
    showResearch?: boolean
    showResearchTrusteeship?: boolean
    showResearchBond?: boolean
  }
}

interface ResearchDocument {
  id: string
  filename: string
  url: string
  companies?: any[] // Can be Company objects, IDs, or join objects
}

interface ProcessedCompany {
  id: string
  name: string
  percentageHolding: number
  hasResearchDoc: boolean
  researchDoc?: ResearchDocument
  isGroupHeader?: boolean
  isGroupItem?: boolean
  isCollapsed?: boolean
  subsidiaryCount?: number
  parentCompanyId?: string
  passiveFunds?: boolean
  // Research permissions
  showResearchPrivate?: boolean
  showResearch?: boolean
  showResearchTrusteeship?: boolean
  showResearchBond?: boolean
}

interface ResearchDocumentsViewProps {
  refreshTrigger?: number
}

const ResearchDocumentsView: React.FC<ResearchDocumentsViewProps> = ({ refreshTrigger }) => {
  const [processedData, setProcessedData] = useState<ProcessedCompany[]>([])
  const [researchDocs, setResearchDocs] = useState<ResearchDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const documentInfo = useDocumentInfo()
  const meetingType = documentInfo.initialData?.type || 'regular' // regular, bond, trusteeship
  
  // Determine which columns to show based on meeting type
  const getColumnsToShow = () => {
    switch (meetingType) {
      case 'אג"ח':
        return {
          showPrivate: false,
          showGeneral: false,
          showBond: true,
          showTrusteeship: false
        }
      case 'אג"ח כהונת נאמן':
        return {
          showPrivate: false,
          showGeneral: false,
          showBond: false,
          showTrusteeship: true
        }
      default: // regular
        return {
          showPrivate: true,
          showGeneral: true,
          showBond: false,
          showTrusteeship: false
        }
    }
  }
  
  const columnsToShow = getColumnsToShow()

  const getResearchDocForCompany = (companyId: string): ResearchDocument | undefined => {
    console.log("Searching for research doc for company ID:", researchDocs )
    return researchDocs.find((doc) =>
      doc.companies?.some((docCompany) => {
        // Handle different company data structures
        if (typeof docCompany === 'string') {
          return docCompany === companyId
        } else if (docCompany?.id) {
          return docCompany.id === companyId
        } else if (docCompany?.docs && Array.isArray(docCompany.docs)) {
          return docCompany.docs.includes(companyId)
        }
        return false
      })
    )
  }





  const getResearchDocForCompanyDirect = (companyId: string, researchDocuments: ResearchDocument[]): ResearchDocument | undefined => {
    return researchDocuments.find((doc) =>
      doc.companies?.some((docCompany) => {
        // Handle different company data structures
        if (typeof docCompany === 'string') {
          return docCompany === companyId
        } else if (docCompany?.id) {
          return docCompany.id === companyId
        } else if (docCompany?.docs && Array.isArray(docCompany.docs)) {
          return docCompany.docs.includes(companyId)
        }
        return false
      })
    )
  }

  const getResearchDocForParentCompanyDirect = (parentCompanyId: string, childrenIds: string[], researchDocuments: ResearchDocument[]): ResearchDocument | undefined => {
    // First check if parent company has a research doc
    const parentDoc = getResearchDocForCompanyDirect(parentCompanyId, researchDocuments)
    if (parentDoc) return parentDoc
    
    // If not, check if any of the children have a research doc
    for (const childId of childrenIds) {
      const childDoc = getResearchDocForCompanyDirect(childId, researchDocuments)
      if (childDoc) return childDoc
    }
    
    return undefined
  }

  // Check if there's a general research document (not linked to specific companies)
  const hasGeneralResearchDoc = (researchDocuments: ResearchDocument[]): boolean => {
    return researchDocuments.some(doc => !doc.companies || doc.companies.length === 0)
  }

  // Check if there are bond research documents
  const hasBondResearchDoc = (researchDocuments: ResearchDocument[]): boolean => {
    // This should check for bond-specific documents
    // For now, we'll assume any document can be a bond document
    return researchDocuments.length > 0
  }

  // Check if there are trusteeship research documents  
  const hasTrusteeshipResearchDoc = (researchDocuments: ResearchDocument[]): boolean => {
    // This should check for trusteeship-specific documents
    // For now, we'll assume any document can be a trusteeship document
    return researchDocuments.length > 0
  }

  const toggleGroup = (groupId: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupId)) {
      newCollapsed.delete(groupId)
    } else {
      newCollapsed.add(groupId)
    }
    setCollapsedGroups(newCollapsed)
  }

  const handleDocumentClick = (doc: ResearchDocument) => {
    const link = document.createElement('a')
    link.href = doc.url
    link.download = doc.filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const processCompaniesByParent = (companies: Company[], researchDocuments: ResearchDocument[]): ProcessedCompany[] => {
    if (!groupBy) {
      
      return companies.map(company => ({
        id: company.id,
        name: company.name,
        percentageHolding: company.percentageHolding || 0,
        hasResearchDoc: !!getResearchDocForCompanyDirect(company.id, researchDocuments),
        researchDoc: getResearchDocForCompanyDirect(company.id, researchDocuments),
        passiveFunds: company.passiveFunds,
        showResearchPrivate: company.researchDocuments?.showResearchPrivate,
        showResearch: company.researchDocuments?.showResearch,
        showResearchTrusteeship: company.researchDocuments?.showResearchTrusteeship,
        showResearchBond: company.researchDocuments?.showResearchBond
      }))
    }
    
   const mappedCompanies = companies.map(company => {
   const parentName = company.parentCompany?.name || company.name
  
  return {
    ...company,
    parentCompany: parentName
  }
})

const grouped = groupCompaniesByParent(mappedCompanies)

    const result: ProcessedCompany[] = []

    // Process each parent group
    grouped.forEach((companiesInGroup, parentKey) => {
      // Check if this is actually a parent group (has multiple companies or has children with different names)
      const isParentGroup = companiesInGroup.length > 1 || 
        companiesInGroup.some((c: any) => c.parentCompany !== c.name)
      
      if (isParentGroup) {
        // This is a parent group with children
        const parentCompany = companiesInGroup.find((c: any) => c.name === parentKey) || companiesInGroup[0]
        
        const isCollapsed = collapsedGroups.has(parentKey)
        const allCompanyIds = companiesInGroup.map((c: any) => c.id)
        const parentResearchDoc = getResearchDocForParentCompanyDirect(parentCompany.id, allCompanyIds, researchDocuments)
        
        // Calculate totals
        const totalPercentage = companiesInGroup.reduce((sum: number, c: any) => sum + (c.percentageHolding || 0), 0)
        
        // Add parent header
        result.push({
          id: parentKey,
          name: parentKey,
          percentageHolding: totalPercentage,
          hasResearchDoc: !!parentResearchDoc,
          researchDoc: parentResearchDoc,
          isGroupHeader: true,
          isCollapsed,
          subsidiaryCount: companiesInGroup.length
        })

        // Add children if not collapsed
        if (!isCollapsed) {
          companiesInGroup.forEach((child: any) => {
            result.push({
              id: child.id,
              name: child.name,
              percentageHolding: child.percentageHolding || 0,
              hasResearchDoc: !!parentResearchDoc, // Show ✅ if parent group has research doc
              researchDoc: undefined, // Don't show download button for children
              isGroupItem: true,
              parentCompanyId: parentKey,
              passiveFunds: child.passiveFunds,
              showResearchPrivate: child.researchDocuments?.showResearchPrivate,
              showResearch: child.researchDocuments?.showResearch,
              showResearchTrusteeship: child.researchDocuments?.showResearchTrusteeship,
              showResearchBond: child.researchDocuments?.showResearchBond
            })
          })
        }
      } else {
        // Single company - also display as group format
        const company = companiesInGroup[0]
        const isCollapsed = collapsedGroups.has(parentKey)
        const companyResearchDoc = getResearchDocForCompanyDirect(company.id, researchDocuments)
        
        // Add parent header (the company itself)
        result.push({
          id: parentKey,
          name: parentKey,
          percentageHolding: company.percentageHolding || 0,
          hasResearchDoc: !!companyResearchDoc,
          researchDoc: companyResearchDoc,
          isGroupHeader: true,
          isCollapsed,
          subsidiaryCount: 1
        })

        // Add the company as child if not collapsed
        if (!isCollapsed) {
          result.push({
            id: company.id,
            name: company.name,
            percentageHolding: company.percentageHolding || 0,
            hasResearchDoc: !!companyResearchDoc, // Show ✅ if group has research doc
            researchDoc: undefined, // Don't show download button for child
            isGroupItem: true,
            parentCompanyId: parentKey,
            passiveFunds: company.passiveFunds,
            showResearchPrivate: company.researchDocuments?.showResearchPrivate,
            showResearch: company.researchDocuments?.showResearch,
            showResearchTrusteeship: company.researchDocuments?.showResearchTrusteeship,
            showResearchBond: company.researchDocuments?.showResearchBond
          })
        }
      }
    })

    return result
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get data from useDocumentInfo - much better performance!
        const data = documentInfo.initialData
        
        const companiesIds: string[] = data?.companies || []
        const researchDocumentIds: string[] = data?.researchDocuments || []
        const fundsWithHolding = data?.fundsWithHolding || []
        let stockValueData = null
        if (data?.stockValue && typeof data?.stockValue === 'string') {
          try {
            const stockValueResponse = await fetch(`/api/stock-values/${data.stockValue}`)
            if (stockValueResponse.ok) {
              stockValueData = await stockValueResponse.json()
            }
          } catch (error) {
            console.error('Error fetching stock value:', error)
          }
        } else if (typeof data?.stockValue === 'object') {
          stockValueData = data?.stockValue
        }
        // Fetch companies with parentCompany data only if we have IDs
        let companies: Company[] = []
        if (companiesIds.length > 0) {
          try {
            const companiesQuery = stringify(
              {
                where: {
                  id: { in: companiesIds },
                },
                select: {
                  id: true,
                  name: true,
                  parentCompany: true,
                  passiveFunds: true,
                  researchDocuments: true,
                },
                depth: 2,
                limit: 0,
              },
              { addQueryPrefix: true },
            )
            const companiesResponse = await fetch(`/api/companies${companiesQuery}`)
            if (companiesResponse.ok) {
              const companiesData = await companiesResponse.json()
              companies = companiesData.docs || []
            }
          } catch (error) {
            console.error('Error fetching companies details:', error)
            companies = []
          }
        }
        
        // Fetch research documents with full data only if we have IDs
        let researchDocuments: ResearchDocument[] = []
        if (researchDocumentIds.length > 0) {
          try {
            const researchDocsQuery = stringify(
              {
                where: {
                  id: { in: researchDocumentIds },
                },
                select: {
                  id: true,
                  filename: true,
                  url: true,
                  companies: true,
                },
                depth: 2,
                limit: 0,
              },
              { addQueryPrefix: true },
            )
            const researchDocsResponse = await fetch(`/api/research-documents${researchDocsQuery}`)
            if (researchDocsResponse.ok) {
              const researchDocsData = await researchDocsResponse.json()
              researchDocuments = researchDocsData.docs || []
            }
          } catch (error) {
            console.error('Error fetching research documents details:', error)
            researchDocuments = []
          }
        }
        
        // Calculate holding values for each company using fundsWithHolding
        const companiesWithCalculatedValues = companies.map(company => {
          // Find all funds for this company (there can be multiple)
          const fundMatches = fundsWithHolding.filter((item: any) => {
            return item.company && (item.company as string) === company.id
          })
          if (fundMatches.length > 0 && stockValueData) {
            let totalQuantity = 0
            
            // Sum up quantities from all funds for this company
            fundMatches.forEach((fundMatch: any) => {
              let quantity = 0
              
              // Get quantity like in the example code
              if (fundMatch.ownedQuantity) {
                quantity = fundMatch.ownedQuantity
              } else if (fundMatch.quantity) {
                quantity = fundMatch.quantity
              }
              
              totalQuantity += quantity
            })

            if (totalQuantity > 0) {
              // Calculate values for this company's total holdings
              const { percentageHolding, holdingValueInMillions } = 
                calculateHoldingValues(totalQuantity, stockValueData)
              
              return {
                ...company,
                percentageHolding,
                holdingValueInMillions
              }
            }
          }
          
          return {
            ...company,
            percentageHolding: 0
          }
        })
        setResearchDocs(researchDocuments)
        
        // Process the data for display using the existing grouping function
        const processedCompanies = processCompaniesByParent(companiesWithCalculatedValues, researchDocuments)
        setProcessedData(processedCompanies)
      } catch (error) {
        console.error('Error fetching research documents data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (documentInfo.initialData) {
      fetchData()
    }
  }, [documentInfo.initialData, refreshTrigger, groupBy, collapsedGroups])

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="useTw space-y-6 p-6 text-base" dir="rtl">
      {/* Main companies table */}
      <Card style={{ width: '75%' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">מסמכי מחקר</CardTitle>
              <CardDescription>
                {processedData.filter(item => !item.isGroupHeader).length} חברות באסיפה
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span
                style={{
                  border: '1px solid rgb(0 0 0 / 0.3)',
                  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                }}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-base font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer h-9 px-3 shadow-sm',
                  groupBy
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 border border-primary'
                    : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
                )}
                onClick={() => setGroupBy(!groupBy)}
              >
                {groupBy ? (
                  <>
                    <Ungroup className="h-4 w-4 ml-2" />
                    קיבוץ
                  </>
                ) : (
                  <>
                    <Group className="h-4 w-4 ml-2" />
                    קיבוץ
                  </>
                )}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>חברה</TableHead>
                <TableHead>אחוזים</TableHead>
                {columnsToShow.showPrivate && <TableHead>מסמך מחקר פרטי</TableHead>}
                {columnsToShow.showGeneral && <TableHead>מסמך כללי</TableHead>}
                {columnsToShow.showBond && <TableHead>אג"ח</TableHead>}
                {columnsToShow.showTrusteeship && <TableHead>אג"ח נאמנות</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedData.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    item.isGroupHeader && 'bg-muted/50 font-semibold',
                    item.isGroupItem && 'bg-muted/20',
                  )}
                >
                  <TableCell>
                    <div className={cn('flex items-center gap-2', item.isGroupItem && 'mr-6')}>
                      {item.isGroupHeader && (
                        <>
                          <span
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-base font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => toggleGroup(item.id)}
                          >
                            {item.isCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                          <Building2 className="h-4 w-4" />
                        </>
                      )}
                      <span className={cn(item.isGroupHeader && 'font-semibold')}>
                        {item.name}
                        {item.passiveFunds && !item.isGroupHeader && (
                          <b className="mr-1"> מחקות בלבד</b>
                        )}
                        {item.isGroupHeader && (
                          <span className="text-base text-muted-foreground mr-2">
                            ({item.subsidiaryCount} חברות)
                            {item.isCollapsed && ' - מכווץ'}
                          </span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{`${item.percentageHolding.toFixed(4)}%`}</TableCell>
                  {/* מסמך מחקר פרטי */}
                  {columnsToShow.showPrivate && (
                    <TableCell>
                      {item.isGroupHeader && item.researchDoc ? (
                     <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDocumentClick(item.researchDoc!)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleDocumentClick(item.researchDoc!)
                        }
                      }}
                      title={`הורד מסמך: ${item.researchDoc.filename}`}
                      className="group inline-flex items-center justify-center cursor-pointer
                                transition-transform hover:scale-110 hover:brightness-110"
                    >
                      <SingleDocumentIcon className="w-6 h-6 text-gray-500 transition-colors duration-200 group-hover:text-blue-600" />
                    </span>

                      ) : item.isGroupItem && item.showResearchPrivate && item.hasResearchDoc ? (
                        <span className="text-lg">✅</span>
                      ) : item.isGroupItem && item.showResearchPrivate && !item.hasResearchDoc ? (
                        <span className="text-lg text-red-600 font-bold animate-pulse" title="חסר מסמך מחקר פרטי - דרוש טיפול!">❌</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  )}
                  
                  {/* מסמך כללי */}
                  {columnsToShow.showGeneral && (
                    <TableCell>
                      {item.isGroupItem && item.showResearch && hasGeneralResearchDoc(researchDocs) ? (
                        <span className="text-lg">✅</span>
                      ) : item.isGroupItem && item.showResearch && !hasGeneralResearchDoc(researchDocs) ? (
                        <span className="text-lg text-red-600 font-bold animate-pulse" title="חסר מסמך מחקר כללי - דרוש טיפול!">❌</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  )}
                  
                  {/* אג"ח */}
                  {columnsToShow.showBond && (
                    <TableCell>
                      {item.isGroupItem && item.showResearchBond && hasBondResearchDoc(researchDocs) ? (
                        <span className="text-lg">✅</span>
                      ) : item.isGroupItem && item.showResearchBond && !hasBondResearchDoc(researchDocs) ? (
                        <span className="text-lg text-red-600 font-bold animate-pulse" title="חסר מסמך מחקר אג״ח - דרוש טיפול!">❌</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  )}
                  
                  {/* אג"ח נאמנות */}
                  {columnsToShow.showTrusteeship && (
                    <TableCell>
                      {item.isGroupItem && item.showResearchTrusteeship && hasTrusteeshipResearchDoc(researchDocs) ? (
                        <span className="text-lg">✅</span>
                      ) : item.isGroupItem && item.showResearchTrusteeship && !hasTrusteeshipResearchDoc(researchDocs) ? (
                        <span className="text-lg text-red-600 font-bold animate-pulse" title="חסר מסמך מחקר אג״ח נאמנות - דרוש טיפול!">❌</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* General research documents */}
      {researchDocs.some((doc) => !doc.companies || doc.companies.length === 0) && (
        <Card style={{ width: '75%' }}>
          <CardHeader>
            <CardTitle className="text-lg">מסמכי מחקר כלליים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {researchDocs
                .filter((doc) => !doc.companies || doc.companies.length === 0)
                .map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between bg-muted/30 dark:bg-gray-700/30 rounded-md px-3 py-2"
                  >
                    <span className="text-gray-900 dark:text-white font-medium">
                      {doc.filename}
                    </span>
                   <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDocumentClick(doc)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleDocumentClick(doc)
                      }
                    }}
                    title={`הורד מסמך: ${doc.filename}`}
                    className="group inline-flex items-center justify-center cursor-pointer
                              transition-transform hover:scale-110 hover:brightness-110"
                  >
                    <SingleDocumentIcon className="w-6 h-6 text-gray-500 transition-colors duration-200 group-hover:text-blue-600" />
                  </span>

                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ResearchDocumentsView