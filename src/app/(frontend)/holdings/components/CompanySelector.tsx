'use client'

import type React from 'react'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export interface TreeNode {
  id: string
  name: string
  children?: TreeNode[]
}

interface CompanyTreeSelectorProps {
  companies: TreeNode[]
  selectedCompanies: string[]
  onSelectionChange: (selected: string[]) => void
  className?: string
}

export function CompanyTreeSelector({
  companies,
  selectedCompanies,
  onSelectionChange,
  className,
}: CompanyTreeSelectorProps) {
  const [expandedNodes, setExpandedNodes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [internalSelectedCompanies, setInternalSelectedCompanies] =
    useState<string[]>(selectedCompanies)
  const treeContainerRef = useRef<HTMLDivElement>(null)
  const [shouldScroll, setShouldScroll] = useState(false)
  const [filteredCompanies, setFilteredCompanies] = useState<TreeNode[]>(companies)

  // Add a new function to collect all node IDs that have children
  const getAllParentNodeIds = useCallback((nodes: TreeNode[]): string[] => {
    let result: string[] = []
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        result.push(node.id)
        result = result.concat(getAllParentNodeIds(node.children))
      }
    })
    return result
  }, [])

  // Add a new useEffect to expand all nodes by default when companies change
  useEffect(() => {
    const allParentIds = getAllParentNodeIds(companies)
    setExpandedNodes(allParentIds)
  }, [companies, getAllParentNodeIds])

  // Update internal selection when prop changes
  useEffect(() => {
    setInternalSelectedCompanies(selectedCompanies)
  }, [selectedCompanies])

  // Check if tree content exceeds viewport and enable scrolling if needed
  useEffect(() => {
    if (!treeContainerRef.current) return

    const checkSize = () => {
      const container = treeContainerRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const containerBottom = containerRect.top + container.scrollHeight

      // If the bottom of the container would go beyond viewport, enable scrolling
      if (containerBottom > viewportHeight - 20) {
        // 20px buffer
        setShouldScroll(true)
      } else {
        setShouldScroll(false)
      }
    }

    // Check initially and whenever content might change
    checkSize()

    // Also check on window resize
    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [filteredCompanies, expandedNodes])

  // Get all descendant IDs for a node
  const getAllDescendantIds = (node: TreeNode): string[] => {
    let result: string[] = []
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        result.push(child.id)
        result = result.concat(getAllDescendantIds(child))
      })
    }
    return result
  }

  // Check if a node is a leaf node (no children)
  const isLeafNode = (node: TreeNode | null): boolean => {
    return !node?.children || node.children.length === 0
  }

  // Find a node by ID
  const findNode = (nodes: TreeNode[], id: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node
      }
      if (node.children && node.children.length > 0) {
        const foundInChildren = findNode(node.children, id)
        if (foundInChildren) return foundInChildren
      }
    }
    return null
  }

  // Get all leaf node IDs from a selection
  const getLeafNodesOnly = (selection: string[]): string[] => {
    return selection.filter((id) => {
      const node = findNode(companies, id)
      return isLeafNode(node)
    })
  }

  // Recursively check node selection state
  const getNodeSelectionState = (node: TreeNode): 'checked' | 'unchecked' | 'indeterminate' => {
    // If the node has no children, just check if it's selected
    if (!node.children || node.children.length === 0) {
      return internalSelectedCompanies.includes(node.id) ? 'checked' : 'unchecked'
    }

    // Check children states
    const childStates = node.children.map((child) => {
      return {
        id: child.id,
        state: getNodeSelectionState(child),
      }
    })

    const allChildrenChecked = childStates.every((child) => child.state === 'checked')
    const anyChildChecked = childStates.some(
      (child) => child.state === 'checked' || child.state === 'indeterminate',
    )

    // If the node itself is selected but not all children are selected, it should be indeterminate
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

    const currentState = getNodeSelectionState(node)
    const newState = forceState !== undefined ? forceState : currentState !== 'checked'

    let newSelection = [...internalSelectedCompanies]

    // Get all descendants of this node
    const descendants = getAllDescendantIds(node)

    if (newState) {
      // Add this node and all descendants to selection
      if (!newSelection.includes(companyId)) {
        newSelection.push(companyId)
      }

      descendants.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id)
        }
      })
    } else {
      // Remove this node and all descendants from selection
      newSelection = newSelection.filter((id) => id !== companyId && !descendants.includes(id))
    }

    setInternalSelectedCompanies(newSelection)

    // Only pass leaf nodes to the parent component
    const leafNodesOnly = getLeafNodesOnly(newSelection)
    onSelectionChange(leafNodesOnly)
  }

  const handleChildSelect = (childId: string, checked: boolean) => {
    // Find the child node and its parent
    const findNodeAndParent = (
      nodes: TreeNode[],
      id: string,
      parent: TreeNode | null = null,
    ): { node: TreeNode | null; parent: TreeNode | null } => {
      for (const node of nodes) {
        if (node.id === id) {
          return { node, parent }
        }
        if (node.children && node.children.length > 0) {
          const result = findNodeAndParent(node.children, id, node)
          if (result.node) return result
        }
      }
      return { node: null, parent: null }
    }

    const { node, parent } = findNodeAndParent(companies, childId)
    if (!node) return

    let newSelection = [...internalSelectedCompanies]

    if (checked) {
      // Add this child to selection
      if (!newSelection.includes(childId)) {
        newSelection.push(childId)
      }

      // If all siblings are now selected, select the parent too
      if (parent && parent.children) {
        const allSiblingsSelected = parent.children.every(
          (sibling) => sibling.id === childId || newSelection.includes(sibling.id),
        )

        if (allSiblingsSelected && !newSelection.includes(parent.id)) {
          newSelection.push(parent.id)
        }
      }
    } else {
      // Remove this child from selection
      newSelection = newSelection.filter((id) => id !== childId)

      // If parent was selected, put it in indeterminate state by removing it from selection
      if (parent && newSelection.includes(parent.id)) {
        newSelection = newSelection.filter((id) => id !== parent.id)
      }
    }

    setInternalSelectedCompanies(newSelection)

    // Only pass leaf nodes to the parent component
    const leafNodesOnly = getLeafNodesOnly(newSelection)
    onSelectionChange(leafNodesOnly)
  }

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNodes((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    )
  }

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

  // Recursive component to render tree nodes
  const TreeItems = ({ nodes, level = 0 }: { nodes: TreeNode[]; level?: number }) => {
    return nodes.map((node, index) => {
      const selectionState = getNodeSelectionState(node)
      const isNodeLeaf = isLeafNode(node)

      return (
        <div key={`${node.id}-${index}-${level}`} className="w-full">
          <div
            className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-gray-100 rounded-sm cursor-pointer"
            onClick={() =>
              isNodeLeaf
                ? handleChildSelect(node.id, selectionState !== 'checked')
                : handleSelect(node.id)
            }
            style={{ paddingRight: level > 0 ? `${level * 16 + 16}px` : undefined }}
          >
            <div className="flex items-center min-w-0">
              {node.children && node.children.length > 0 ? (
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
                    selectionState === 'indeterminate' && 'data-[state=indeterminate]:bg-gray-400',
                  )}
                  aria-label={`Select ${node.name}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <span className="truncate mr-1 block">{node.name}</span>
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

  return (
    <div className={className} dir="rtl">
      <div className="relative border rounded-md p-2">
        <div className="mb-2">
          <input
            type="text"
            placeholder="חפש חברה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 px-2 text-sm bg-transparent border border-gray-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
        <div
          ref={treeContainerRef}
          className={cn('w-full', shouldScroll ? 'max-h-[calc(100vh-350px)] overflow-auto' : '')}
        >
          {filteredCompanies.length > 0 ? (
            <TreeItems nodes={filteredCompanies} />
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
