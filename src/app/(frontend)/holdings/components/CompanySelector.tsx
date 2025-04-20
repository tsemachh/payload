'use client'

import type React from 'react'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronLeft, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
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
  const [open, setOpen] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [internalSelectedCompanies, setInternalSelectedCompanies] =
    useState<string[]>(selectedCompanies)

  // Set isClient to true after component mounts
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Update internal selection when prop changes
  useEffect(() => {
    setInternalSelectedCompanies(selectedCompanies)
  }, [selectedCompanies])

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
    console.log('leafNodesOnly', leafNodesOnly)
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
    console.log('leafNodesOnly', leafNodesOnly)
    onSelectionChange(leafNodesOnly)
  }

  const handleRemoveCompany = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    handleChildSelect(companyId, false)
  }

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNodes((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId],
    )
  }

  // Flatten tree for search and display of selected items
  const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.reduce<TreeNode[]>((acc, node) => {
      acc.push(node)
      if (node.children && node.children.length > 0) {
        acc.push(...flattenTree(node.children))
      }
      return acc
    }, [])
  }

  const flatCompanies = flattenTree(companies)

  // Filter tree based on search query
  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
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
  }

  const filteredCompanies = filterTree(companies, searchQuery)

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
          <CommandItem
            value={`${node.id}-${node.name}`}
            onSelect={() =>
              isNodeLeaf
                ? handleChildSelect(node.id, selectionState !== 'checked')
                : handleSelect(node.id)
            }
            className="flex items-center justify-between w-full"
            style={{ paddingRight: level > 0 ? `${level * 16 + 16}px` : undefined }}
          >
            <div className="flex items-center" onClick={(e) => toggleExpand(node.id, e)}>
              {node.children && node.children.length > 0 ? (
                expandedNodes.includes(node.id) ? (
                  <ChevronDown className="z-99 mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                ) : (
                  <ChevronLeft className="z-99 mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                )
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
              <span className="truncate mr-1">{node.name}</span>
            </div>
          </CommandItem>

          {node.children && node.children.length > 0 && expandedNodes.includes(node.id) && (
            <TreeItems nodes={node.children} level={level + 1} />
          )}
        </div>
      )
    })
  }

  // Calculate the height of the dropdown based on the number of items
  const getDropdownHeight = () => {
    const baseHeight = 300 // Default max height
    const itemCount = flattenTree(filteredCompanies).length
    const estimatedHeight = Math.min(itemCount * 36 + 50, baseHeight) // 36px per item + padding
    return estimatedHeight
  }

  // Count selected leaf nodes
  const countSelectedLeafNodes = () => {
    return internalSelectedCompanies.filter((id) => {
      const node = findNode(companies, id)
      return isLeafNode(node)
    }).length
  }

  return (
    <div className={className} dir="rtl">
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="min-w-[200px] h-10 justify-between"
            >
              <span className="truncate">
                {!isClient || internalSelectedCompanies.length === 0
                  ? 'בחר חברות'
                  : `${countSelectedLeafNodes()} חברות עלה נבחרו`}
              </span>
              <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 z-50"
            align="start"
            side="bottom"
            style={{ maxHeight: `${getDropdownHeight()}px` }}
            sideOffset={5}
          >
            <Command className="w-full" dir="rtl">
              <CommandInput
                placeholder="חפש חברה..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList className="w-full">
                <CommandEmpty>לא נמצאו חברות.</CommandEmpty>
                <CommandGroup className="max-h-[300px] overflow-auto w-full">
                  <TreeItems nodes={filteredCompanies} />
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {isClient && internalSelectedCompanies.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {internalSelectedCompanies.map((id) => {
            const company = flatCompanies.find((c) => c.id === id)
            // Only show badges for leaf nodes (nodes without children)
            if (company && (!company.children || company.children.length === 0)) {
              return (
                <Badge key={id} variant="secondary" className="px-3 py-1">
                  {company.name}
                  <button
                    className="mr-2 text-muted-foreground hover:text-foreground"
                    onClick={(e) => handleRemoveCompany(id, e)}
                  >
                    ×
                  </button>
                </Badge>
              )
            }
            return null
          })}
        </div>
      )}

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
