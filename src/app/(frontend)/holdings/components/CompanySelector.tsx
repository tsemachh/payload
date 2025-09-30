'use client'

import type React from 'react'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, ChevronLeft, Loader2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { TreeCompanyType } from '@/types/companies'
import { useAuth } from '@/providers/auth-provider'

interface CompanyTreeSelectorProps {
  selectedCompanies: string[]
  onSelectionChangeAction: (selected: string[]) => Promise<void> | void
  className?: string
  isLoading?: boolean
  showSearch?: boolean
  allCompaniesIds?: string[]
  showFunds?: boolean
  showBorder?: boolean
}

export function CompanyTreeSelector({
  selectedCompanies,
  onSelectionChangeAction,
  className,
  isLoading = false,
  showSearch = true,
  allCompaniesIds = [],
  showFunds = true,
  showBorder = false,
}: CompanyTreeSelectorProps) {
  const [companies, setCompanies] = useState<TreeCompanyType[]>([])
  const [expandedNodes, setExpandedNodes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [internalSelectedCompanies, setInternalSelectedCompanies] =
    useState<string[]>(selectedCompanies)
  const treeContainerRef = useRef<HTMLDivElement>(null)
  const [shouldScroll, setShouldScroll] = useState(false)
  const [filteredCompanies, setFilteredCompanies] = useState<TreeCompanyType[]>(companies)
  const { user } = useAuth()

  useEffect(() => {
    setCompanies(JSON.parse(user?.treeCompanies || '[]'))
  }, [user])

  const getAllParentNodeIds = useCallback((nodes: TreeCompanyType[]): string[] => {
    let result: string[] = []
    nodes.forEach((node) => {
      if (node.subCompanies && node.subCompanies.length > 0) {
        result.push(node.id)
        result = result.concat(getAllParentNodeIds(node.subCompanies))
      }
    })
    return result
  }, [])

  useEffect(() => {
    const allParentIds = getAllParentNodeIds(companies)
    setExpandedNodes(allParentIds)
  }, [companies, getAllParentNodeIds])

  useEffect(() => {
    setInternalSelectedCompanies(selectedCompanies)
  }, [selectedCompanies])

  useEffect(() => {
    if (!treeContainerRef.current) return

    const checkSize = () => {
      const container = treeContainerRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const containerBottom = containerRect.top + container.scrollHeight

      if (containerBottom > viewportHeight - 20) {
        setShouldScroll(true)
      } else {
        setShouldScroll(false)
      }
    }

    checkSize()

    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [filteredCompanies, expandedNodes])

  const getAllDescendantIds = (node: TreeCompanyType): string[] => {
    let result: string[] = []
    if (node.subCompanies && node.subCompanies.length > 0) {
      node.subCompanies.forEach((child) => {
        result.push(child.id)
        result = result.concat(getAllDescendantIds(child))
      })
    }
    return result
  }

  const isLeafNode = (node: TreeCompanyType | null): boolean => {
    return !node?.subCompanies || node.subCompanies.length === 0
  }

  const findNode = (nodes: TreeCompanyType[], id: string): TreeCompanyType | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node
      }
      if (node.subCompanies && node.subCompanies.length > 0) {
        const foundInChildren = findNode(node.subCompanies, id)
        if (foundInChildren) return foundInChildren
      }
    }
    return null
  }

  const getLeafNodesOnly = (selection: string[]): string[] => {
    return selection.filter((id) => {
      const node = findNode(companies, id)
      return isLeafNode(node)
    })
  }

  const getNodeSelectionState = (
    node: TreeCompanyType,
  ): 'checked' | 'unchecked' | 'indeterminate' => {
    if (!showFunds || !node.subCompanies || node.subCompanies.length === 0) {
      return internalSelectedCompanies.includes(node.id) ? 'checked' : 'unchecked'
    }

    const childStates = node.subCompanies.map((child) => {
      return {
        id: child.id,
        state: getNodeSelectionState(child),
      }
    })

    const allChildrenChecked = childStates.every((child) => child.state === 'checked')
    const anyChildChecked = childStates.some(
      (child) => child.state === 'checked' || child.state === 'indeterminate',
    )

    if (internalSelectedCompanies.includes(node.id) && !allChildrenChecked) {
      return 'indeterminate'
    } else if (allChildrenChecked) {
      return 'checked'
    } else if (anyChildChecked) {
      return 'indeterminate'
    } else {
      return 'unchecked'
    }
  }

  const handleSelect = (companyId: string, forceState?: boolean) => {
    const node = findNode(companies, companyId)
    if (!node) return

    // When subsidiaries are hidden, use simple toggle logic
    if (!showFunds) {
      const isCurrentlySelected = internalSelectedCompanies.includes(companyId)
      const newState = forceState !== undefined ? forceState : !isCurrentlySelected

      let newSelection = [...internalSelectedCompanies]
      if (newState) {
        if (!newSelection.includes(companyId)) {
          newSelection.push(companyId)
        }
      } else {
        newSelection = newSelection.filter((id) => id !== companyId)
      }

      setInternalSelectedCompanies(newSelection)
      onSelectionChangeAction(newSelection)
      return
    }

    // Original hierarchical logic for when subsidiaries are shown
    const currentState = getNodeSelectionState(node)
    const newState = forceState !== undefined ? forceState : currentState !== 'checked'

    let newSelection = [...internalSelectedCompanies]
    const descendants = getAllDescendantIds(node)

    if (newState) {
      if (!newSelection.includes(companyId)) {
        newSelection.push(companyId)
      }
      descendants.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id)
        }
      })
    } else {
      newSelection = newSelection.filter((id) => id !== companyId && !descendants.includes(id))
    }

    setInternalSelectedCompanies(newSelection)

    const leafNodesOnly = getLeafNodesOnly(newSelection)
    onSelectionChangeAction(leafNodesOnly)
  }

  const handleChildSelect = (childId: string, checked: boolean) => {
    // When subsidiaries are hidden, use simple selection logic
    if (!showFunds) {
      let newSelection = [...internalSelectedCompanies]
      if (checked) {
        if (!newSelection.includes(childId)) {
          newSelection.push(childId)
        }
      } else {
        newSelection = newSelection.filter((id) => id !== childId)
      }

      setInternalSelectedCompanies(newSelection)
      onSelectionChangeAction(newSelection)
      return
    }

    // Original hierarchical logic for when subsidiaries are shown
    const findNodeAndParent = (
      nodes: TreeCompanyType[],
      id: string,
      parent: TreeCompanyType | null = null,
    ): { node: TreeCompanyType | null; parent: TreeCompanyType | null } => {
      for (const node of nodes) {
        if (node.id === id) {
          return { node, parent }
        }
        if (node.subCompanies && node.subCompanies.length > 0) {
          const result = findNodeAndParent(node.subCompanies, id, node)
          if (result.node) return result
        }
      }
      return { node: null, parent: null }
    }

    const { node, parent } = findNodeAndParent(companies, childId)
    if (!node) return

    let newSelection = [...internalSelectedCompanies]

    if (checked) {
      if (!newSelection.includes(childId)) {
        newSelection.push(childId)
      }
      if (parent && parent.subCompanies) {
        const allSiblingsSelected = parent.subCompanies.every(
          (sibling) => sibling.id === childId || newSelection.includes(sibling.id),
        )
        if (allSiblingsSelected && !newSelection.includes(parent.id)) {
          newSelection.push(parent.id)
        }
      }
    } else {
      newSelection = newSelection.filter((id) => id !== childId)
      if (parent && newSelection.includes(parent.id)) {
        newSelection = newSelection.filter((id) => id !== parent.id)
      }
    }

    setInternalSelectedCompanies(newSelection)

    const leafNodesOnly = getLeafNodesOnly(newSelection)
    onSelectionChangeAction(leafNodesOnly)
  }

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNodes((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    )
  }

  const filterTree = useCallback((nodes: TreeCompanyType[], query: string): TreeCompanyType[] => {
    if (!query) return nodes

    return nodes
      .map((node) => {
        const matchesQuery = node.name.toLowerCase().includes(query.toLowerCase())
        const filteredChildren = node.subCompanies ? filterTree(node.subCompanies, query) : []

        if (matchesQuery || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.subCompanies,
          }
        }
        return null
      })
      .filter(Boolean) as TreeCompanyType[]
  }, [])

  useEffect(() => {
    const newFilteredCompanies = filterTree(companies, searchQuery)
    setFilteredCompanies(newFilteredCompanies)
  }, [searchQuery, companies, filterTree])

  useEffect(() => {
    if (searchQuery) {
      const nodesToExpand: string[] = []

      const findAndMarkParents = (nodes: TreeCompanyType[]) => {
        nodes.forEach((node) => {
          if (node.subCompanies && node.subCompanies.length > 0) {
            const hasMatchingChild = node.subCompanies.some(
              (child) =>
                child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (child.subCompanies && child.subCompanies.length > 0),
            )

            if (hasMatchingChild) {
              nodesToExpand.push(node.id)
              findAndMarkParents(node.subCompanies)
            }
          }
        })
      }

      findAndMarkParents(companies)
      setExpandedNodes((prev) => [...new Set([...prev, ...nodesToExpand])])
    }
  }, [searchQuery, companies])

  const areAllCompaniesSelected =
    allCompaniesIds.length > 0 && internalSelectedCompanies.length === allCompaniesIds.length
  const areSomeCompaniesSelected = internalSelectedCompanies.length > 0 && !areAllCompaniesSelected

  const selectAllLabel = areAllCompaniesSelected ? 'הסר הכל' : 'בחר הכל'

  const handleSelectAllToggle = () => {
    if (areAllCompaniesSelected) {
      setInternalSelectedCompanies([])
      onSelectionChangeAction([])
    } else {
      const allIds = [...allCompaniesIds]
      setInternalSelectedCompanies(allIds)
      // When subsidiaries are hidden, pass all IDs directly
      if (!showFunds) {
        onSelectionChangeAction(allIds)
      } else {
        onSelectionChangeAction(getLeafNodesOnly(allIds))
      }
    }
  }

  const TreeItems = ({ nodes, level = 0 }: { nodes: TreeCompanyType[]; level?: number }) => {
    return nodes.map((node, index) => {
      const selectionState = getNodeSelectionState(node)
      const isNodeLeaf = !showFunds || isLeafNode(node)
      const hasSubsidiaries = showFunds && node.subCompanies && node.subCompanies.length > 0
      const shouldshowFunds = showFunds && hasSubsidiaries
      return (
        <div key={`${node.id}-${index}-${level}`} className="w-full">
          <div
            className={cn(
              'flex items-center justify-between w-full px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer',
              !node.active && 'cursor-not-allowed', // add not-allowed cursor if inactive
            )}
            style={{
              paddingRight: level > 0 ? `${level * 16 + 16}px` : undefined,
            }}
            title={!node.active?'חברה לא פעילה':''}
            onClick={() => {
              if (!node.active) return // prevent clicks for inactive nodes
              if (isNodeLeaf) {
                handleChildSelect(node.id, selectionState !== 'checked')
              } else {
                handleSelect(node.id)
              }
            }}
          >
            <div className="flex items-center min-w-0">
              {shouldshowFunds ? (
                <div onClick={(e) => toggleExpand(node.id, e)}>
                  {expandedNodes.includes(node.id) ? (
                    <ChevronDown className="z-99 mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                  ) : (
                    <ChevronLeft className="z-99 mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                  )}
                </div>
              ) : (
                <div className="w-5" />
              )}

              <div className="relative mr-3 h-3.5 w-3.5">
                <Checkbox
                  title={!node.active?'חברה לא פעילה':''}
                  id={`checkbox-${node.id}`}
                  checked={selectionState === 'checked'}
                  data-state={selectionState}
                  onCheckedChange={(checked) => {
                    if (isNodeLeaf) {
                      handleChildSelect(node.id, checked === true)
                    } else {
                      handleSelect(node.id)
                    }
                  }}
                  className={cn(
                    'h-3.5 w-3.5 rounded-[3px] border-gray-400 [&>span]:scale-75',
                    showFunds &&
                      selectionState === 'indeterminate' &&
                      'data-[state=indeterminate]:bg-gray-400',
                    !node.active && 'bg-gray-200 border-gray-300',
                  )}
                  aria-label={`Select ${node.name}`}
                  onClick={(e) => e.stopPropagation()}
                  disabled={!node.active}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <span
                  className={cn(
                    'truncate mr-1 block',
                    !node.active && 'text-gray-400 select-none', // grey + not selectable if inactive
                  )}
                >
                  {node.name}
                </span>
              </div>
            </div>
          </div>

          {shouldshowFunds && expandedNodes.includes(node.id) && (
            <TreeItems nodes={node.subCompanies || []} level={level + 1} />
          )}
        </div>
      )
    })
  }

  return (
    <div className={className} dir="rtl">
      <div className={`relative ${showBorder && 'border'} rounded-md p-2`}>
        {showSearch && (
          <div className="mb-2">
            <input
              type="text"
              placeholder="חפש חברה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-7 px-2 text-sm bg-transparent border border-gray-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
              disabled={isLoading}
            />
          </div>
        )}
        <div
          ref={treeContainerRef}
          className={cn('w-full', shouldScroll ? 'max-h-[calc(100vh-350px)] overflow-auto' : '')}
        >
          {isLoading ? (
            <div className="py-8 flex justify-center items-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : companies.length > 0 ? (
            <>
              {!searchQuery && allCompaniesIds.length > 0 && (
                <div
                  className="flex items-center w-full px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer font-medium mb-1"
                  onClick={handleSelectAllToggle}
                >
                  <div className="flex items-center min-w-0">
                    <div className="w-5" />
                    <div className="relative  h-3.5 w-3.5">
                      <Checkbox 
                        id="select-all-checkbox"
                        checked={areAllCompaniesSelected}
                        data-state={
                          areAllCompaniesSelected
                            ? 'checked'
                            : areSomeCompaniesSelected
                              ? 'indeterminate'
                              : 'unchecked'
                        }
                        onCheckedChange={handleSelectAllToggle}
                        className={cn(
                          'h-3.5 w-3.5 rounded-[3px] border-gray-400 [&>span]:scale-75',
                          areSomeCompaniesSelected && 'data-[state=indeterminate]:bg-gray-400',
                        )}
                        aria-label={selectAllLabel}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <span className="truncate mr-1">{selectAllLabel}</span>
                    </div>
                  </div>
                </div>
              )}

              {filteredCompanies.length > 0 ? (
                <TreeItems nodes={filteredCompanies} />
              ) : (
                <div className="py-6 text-center text-sm text-gray-500">
                  לא נמצאו חברות התואמות לחיפוש.
                </div>
              )}
            </>
          ) : (
            <div className="py-6 text-center text-sm text-gray-500">לא נמצאו חברות.</div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .checkbox-custom[data-state='indeterminate']::after {
          content: '';
          display: block;
          width: 8px;
          height: 2px;
          background-color: white;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
      `}</style>
    </div>
  )
}
