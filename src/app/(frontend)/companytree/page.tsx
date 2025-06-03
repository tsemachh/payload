'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  TreeNode,
  transformCompaniesToTree,
  Company,
  Account,
  fetchCompanies,
  fetchCompanyById,
} from '../helpers/utils-company'
import LoadingSpinnerDiamond from '../components/ui/loading-spinner-diamond'

export default function CompanyTreeView() {
  const [companies, setCompanies] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [companyDetails, setCompanyDetails] = useState<Company | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // Fetch all companies
  useEffect(() => {
    const getCompanies = async () => {
      try {
        const data = await fetchCompanies()

        if (data.docs && Array.isArray(data.docs)) {
          // Transform the flat company structure into a hierarchical tree
          const transformedCompanies = transformCompaniesToTree(
            data.docs.map((company: Company) => ({ company, companyId: company.companyId })),
          )
          setCompanies(transformedCompanies)
        }
      } catch (error) {
        console.error('Error fetching companies:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getCompanies()
  }, [])

  // Fetch company details when a company is selected
  useEffect(() => {
    if (!selectedCompanyId) {
      setCompanyDetails(null)
      return
    }

    const getCompanyDetails = async () => {
      setIsLoadingDetails(true)
      try {
        const data= await fetchCompanyById(selectedCompanyId)
        console.log('Company details:', data)
        setCompanyDetails(data)
      } catch (error) {
        console.error('Error fetching company details:', error)
      } finally {
        setIsLoadingDetails(false)
      }
    }

    getCompanyDetails()
  }, [selectedCompanyId])

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyId(companyId === selectedCompanyId ? null : companyId)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-[600px] items-center pt-[100px]">
        <LoadingSpinnerDiamond />
        <p className="text-center">טוען חברות...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center mb-6">עץ חברות</h1>
      <div className="flex flex-row gap-6">
        <div className="w-1/2 border rounded-md p-4">
          <CompanyTree 
            companies={companies} 
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={handleCompanySelect}
          />
        </div>
        <div className="w-1/2 border rounded-md p-4">
          <CompanyDetails 
            companyDetails={companyDetails} 
            isLoading={isLoadingDetails} 
          />
        </div>
      </div>
    </div>
  )
}

// Component to display the company tree
function CompanyTree({ 
  companies, 
  selectedCompanyId, 
  onSelectCompany 
}: { 
  companies: TreeNode[]; 
  selectedCompanyId: string | null;
  onSelectCompany: (companyId: string) => void;
}) {
  const [expandedNodes, setExpandedNodes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredCompanies, setFilteredCompanies] = useState<TreeNode[]>(companies)

  // Expand all nodes by default
  useEffect(() => {
    const getAllParentNodeIds = (nodes: TreeNode[]): string[] => {
      let result: string[] = []
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          result.push(node.id)
          result = result.concat(getAllParentNodeIds(node.children))
        }
      })
      return result
    }

    const allParentIds = getAllParentNodeIds(companies)
    setExpandedNodes(allParentIds)
  }, [companies])

  // Filter tree based on search query
  const filterTree = useCallback((nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query) return nodes

    return nodes
      .map((node) => {
        const matchesQuery = node.name.toLowerCase().includes(query.toLowerCase())
        const filteredChildren = node.children ? filterTree(node.children, query) : []

        if (matchesQuery || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children,
          }
        }
        return null
      })
      .filter(Boolean) as TreeNode[]
  }, [])

  // Update filtered companies when search query changes
  useEffect(() => {
    const newFilteredCompanies = filterTree(companies, searchQuery)
    setFilteredCompanies(newFilteredCompanies)
  }, [searchQuery, companies, filterTree])

  // Auto-expand parent nodes when searching
  useEffect(() => {
    if (searchQuery) {
      const nodesToExpand: string[] = []

      const findAndMarkParents = (nodes: TreeNode[]) => {
        nodes.forEach((node) => {
          if (node.children && node.children.length > 0) {
            const hasMatchingChild = node.children.some(
              (child) =>
                child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (child.children && child.children.length > 0),
            )

            if (hasMatchingChild) {
              nodesToExpand.push(node.id)
              findAndMarkParents(node.children)
            }
          }
        })
      }

      findAndMarkParents(companies)
      setExpandedNodes((prev) => [...new Set([...prev, ...nodesToExpand])])
    }
  }, [searchQuery, companies])

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNodes((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    )
  }

  // Recursive component to render tree nodes
  const TreeItems = ({ nodes, level = 0 }: { nodes: TreeNode[]; level?: number }) => {
    return nodes.map((node, index) => {
      const isNodeLeaf = !node.children || node.children.length === 0
      const isSelected = node.id === selectedCompanyId

      return (
        <div key={`${node.id}-${index}-${level}`} className="w-full">
          <div
            className={`flex items-center justify-between w-full px-2 py-1.5 hover:bg-gray-100 rounded-sm cursor-pointer ${
              isSelected ? 'bg-blue-100' : ''
            }`}
            style={{ 
              paddingRight: level > 0 ? `${level * 16 + 16}px` : undefined,
              color: 'black',
              backgroundColor: isSelected ? 'inherit' : 
                    node.name.includes('קבוצת') ? 'yellow' : // bg-yellow-300 - Companies with "קבוצת" in their name: yellow
                    node.type  == 'parent' ? 'orange' : // bg-orange-600/60 - Companies with accounts: orange accent 6
                      node.type  == 'regular' ? 'lightblue' : // bg-orange-400 - Parent companies with parent: orange
                        node.type  == 'fund' ? 'peachpuff' : // bg-orange-400 - Parent companies with parent: orange
                    'inherit'
            }}
            onClick={() => onSelectCompany(node.id)}
          >
            <div className="flex items-center min-w-0">
              {node.children && node.children.length > 0 ? (
                <div onClick={(e) => toggleExpand(node.id, e)}>
                  {expandedNodes.includes(node.id) ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="z-99 mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="z-99 mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform"
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  )}
                </div>
              ) : (
                <div className="w-5" />
              )}
              <div className="flex-1 overflow-hidden">
                <span className="truncate mr-1 block">{node.name}({node.companyId})</span>
              </div>
            </div>
          </div>

          {node.children && node.children.length > 0 && expandedNodes.includes(node.id) && (
            <TreeItems nodes={node.children} level={level + 1} />
          )}
        </div>
      )
    })
  }

  const expandAll = () => {
    const getAllNodeIds = (nodes: TreeNode[]): string[] => {
      let result: string[] = []
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          result.push(node.id)
          result = result.concat(getAllNodeIds(node.children))
        }
      })
      return result
    }

    const allNodeIds = getAllNodeIds(companies)
    setExpandedNodes(allNodeIds)
  }

  const collapseAll = () => {
    setExpandedNodes([])
  }

  return (
    <div dir="rtl">
      <div className="sticky top-0 z-10 bg-white p-2 border-b">
        <div className="flex justify-between items-center">
          <input
            type="text"
            placeholder="חפש חברה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-1/3 h-7 px-2 text-sm bg-transparent border border-gray-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <div className="flex gap-2">
            <button 
              onClick={expandAll}
              className="px-2 py-1 text-sm bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-sm"
            >
              הרחב הכל
            </button>
            <button 
              onClick={collapseAll}
              className="px-2 py-1 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-sm"
            >
              כווץ הכל
            </button>
          </div>
        </div>
      </div>
      <div className="max-h-[600px] overflow-auto bg-gray-100">
        {filteredCompanies.length > 0 ? (
          <TreeItems nodes={filteredCompanies} />
        ) : (
          <div className="py-6 text-center text-sm text-gray-500">לא נמצאו חברות.</div>
        )}
      </div>
    </div>
  )
}

// Component to display company details
function CompanyDetails({ 
  companyDetails, 
  isLoading 
}: { 
  companyDetails: Company | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <LoadingSpinnerDiamond />
        <p className="text-center mt-4">טוען פרטי חברה...</p>
      </div>
    )
  }

  if (!companyDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p className="text-center">בחר חברה כדי לראות את הפרטים שלה</p>
      </div>
    )
  }

  return (
    <div dir="rtl" className="max-h-[800px] overflow-auto">
      <h2 className="text-xl font-bold mb-4">{companyDetails.name}</h2>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">פרטי חברה</h3>
          <div className="grid grid-cols-6 gap-2">
            <div className="font-medium">מספר חברה:</div>
            <div>{companyDetails.companyId || 'לא זמין'}</div>

            <div className="font-medium">סטטוס:</div>
            <div>{companyDetails.active ? 'פעיל' : 'לא פעיל'}</div>

            <div className="font-medium">סוג חברה:</div>
            <div>{companyDetails.type === 'regular' ? 'רגיל' : 
                  companyDetails.type === 'parent' ? 'הורה' : 
                  companyDetails.type === 'fund' ? 'קרן' : 
                  companyDetails.type || 'לא זמין'}</div>

            {companyDetails.holdings && (
              <>
                <div className="font-medium">מספר אחזקות:</div>
                <div>{companyDetails.holdings.docs?.length || 0}</div>
              </>
            )}

            {companyDetails.meetings && (
              <>
                <div className="font-medium">מספר פגישות:</div>
                <div>{companyDetails.meetings.docs?.length || 0}</div>
              </>
            )}
          </div>
        </div>

        {companyDetails.mainAccount && companyDetails.mainAccount.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">חשבונות</h3>
            {companyDetails.mainAccount.map((account: Account, index: number) => (
              <div key={index} className="mb-2 p-2 border rounded">
                <div className="grid grid-cols-2 gap-2">
                  <div className="font-medium">מספר חשבון:</div>
                  <div>{account.accountNumber}</div>

                  <div className="font-medium">שם חשבון:</div>
                  <div>{account.accountName || 'לא זמין'}</div>

                  {account.subAccounts && account.subAccounts.length > 0 && (
                    <>
                      <div className="font-medium">תתי חשבונות:</div>
                      <div>{account.subAccounts.join(', ')}</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {companyDetails.subCompanies && companyDetails.subCompanies.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">חברות בת</h3>
            <ul className="list-disc list-inside">
              {companyDetails.subCompanies.map((subCompany) => (
                <li key={typeof subCompany === 'string' ? subCompany : subCompany.id}>
                  {typeof subCompany === 'string' ? subCompany : subCompany.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {companyDetails.parentCompany && (
          <div>
            <h3 className="text-lg font-semibold mb-2">חברת אם</h3>
            <ul className="list-disc list-inside">
              {(companyDetails.parentCompany as  {docs:Company[]}).docs
                ? (companyDetails.parentCompany as  {docs:Company[]}).docs.map((parent: Company) => (
                    <li key={parent.id}>{parent.name}</li>
                  ))
                : Array.isArray(companyDetails.parentCompany)
                  ? companyDetails.parentCompany.map((parent: Company) => (
                      <li key={parent.id}>{parent.name}</li>
                    ))
                  : <li key={(companyDetails.parentCompany as Company).id}>{(companyDetails.parentCompany as Company).name}</li>
              }
            </ul>
          </div>
        )}

        {companyDetails.silencedStocks && companyDetails.silencedStocks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">ניירות ערך מושתקים</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>{companyDetails.silencedStocks.join(', ')}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
