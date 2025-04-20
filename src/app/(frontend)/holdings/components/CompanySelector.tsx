'use client'

import type React from 'react'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronLeft, ChevronsUpDown } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
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

  // Set isClient to true after component mounts
  useEffect(() => {
    setIsClient(true)
  }, [])

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
  
    // Check if all children of a node are selected
    const areAllChildrenSelected = (node: TreeNode): boolean => {
      if (!node.children || node.children.length === 0) return false
  
      return node.children.every((child) => {
        const childDescendantIds = getAllDescendantIds(child)
        const allIds = [child.id, ...childDescendantIds]
        return allIds.every((id) => selectedCompanies.includes(id))
      })
    }
  
    // Check if some but not all children of a node are selected
    const areSomeChildrenSelected = (node: TreeNode): boolean => {
      if (!node.children || node.children.length === 0) return false
  
      const hasSelectedChild = node.children.some((child) => {
        const childDescendantIds = getAllDescendantIds(child)
        const allIds = [child.id, ...childDescendantIds]
        return allIds.some((id) => selectedCompanies.includes(id))
      })
  
      return hasSelectedChild && !areAllChildrenSelected(node)
    }

  const handleSelect = (companyId: string) => {
    const isSelected = selectedCompanies.includes(companyId)

    // Find the node and all its descendants
    const findNodeAndDescendants = (nodes: TreeNode[], id: string): string[] => {
      for (const node of nodes) {
        if (node.id === id) {
          // Found the node, collect all descendants
          const descendants: string[] = [node.id]
          if (node.children && node.children.length > 0) {
            node.children.forEach((child) => {
              descendants.push(...findNodeAndDescendants(node.children || [], child.id))
            })
          }
          return descendants
        } else if (node.children && node.children.length > 0) {
          // Check children
          const result = findNodeAndDescendants(node.children, id)
          if (result.length > 0) {
            return result
          }
        }
      }
      return []
    }

    const nodeAndDescendants = findNodeAndDescendants(companies, companyId)

    if (isSelected) {
      // Deselect this node and all its descendants
      onSelectionChange(selectedCompanies.filter((id) => !nodeAndDescendants.includes(id)))
    } else {
      // Select this node and all its descendants
      const newSelection = [...selectedCompanies]
      nodeAndDescendants.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id)
        }
      })
      onSelectionChange(newSelection)
    }
  }

  const handleRemoveCompany = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectionChange(selectedCompanies.filter((id) => id !== companyId))
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
    return nodes.map((node) => {
      const isSelected = selectedCompanies.includes(node.id)
      const allChildrenSelected = areAllChildrenSelected(node)
      const someChildrenSelected = areSomeChildrenSelected(node)

      // If all children are selected, the parent should be selected too
      const checkboxState = allChildrenSelected || isSelected ? true : false

      return (
      <div key={node.id + uuidv4()} className="w-full">
        <CommandItem
          value={`${node.id}-${node.name}`}
          onSelect={() => handleSelect(node.id)}
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
                checked={checkboxState}
                data-state={
                  someChildrenSelected && !isSelected ? "indeterminate" : checkboxState ? "checked" : "unchecked"
                }                onCheckedChange={() => handleSelect(node.id)}
                className={cn(
                  "h-3.5 w-3.5 rounded-[3px] border-gray-400 [&>span]:scale-75",
                  someChildrenSelected && !isSelected && "data-[state=indeterminate]:bg-primary/50",
                )}                aria-label={`Select ${node.name}`}
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
    )})
  }

  // Calculate the height of the dropdown based on the number of items
  const getDropdownHeight = () => {
    const baseHeight = 300 // Default max height
    const itemCount = flattenTree(filteredCompanies).length
    const estimatedHeight = Math.min(itemCount * 36 + 50, baseHeight) // 36px per item + padding
    return estimatedHeight
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
                {!isClient || selectedCompanies.length === 0
                  ? 'בחר חברות'
                  : `${
                      selectedCompanies.filter((id) => {
                        const company = flatCompanies.find((c) => c.id === id)
                        return company && (!company.children || company.children.length === 0)
                      }).length
                    } חברות עלה נבחרו`}
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

      {isClient && selectedCompanies.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedCompanies.map((id) => {
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
    </div>
  )
}
