'use client'
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, ListItemNode, ListNode } from '@lexical/list'
import { $isRangeSelection } from 'lexical'

import type { ToolbarGroup } from '../../toolbars/types.js'
import type { FeatureProviderProviderClient } from '../../types.js'

import { OrderedListIcon } from '../../../lexical/ui/icons/OrderedList/index.js'
import { createClientComponent } from '../../createClientComponent.js'
import { toolbarTextDropdownGroupWithItems } from '../../shared/toolbar/textDropdownGroup.js'
import { LexicalListPlugin } from '../plugin/index.js'
import { ORDERED_LIST } from './markdownTransformer.js'

const toolbarGroups: ToolbarGroup[] = [
  toolbarTextDropdownGroupWithItems([
    {
      ChildComponent: OrderedListIcon,
      isActive: ({ selection }) => {
        if (!$isRangeSelection(selection)) {
          return false
        }
        for (const node of selection.getNodes()) {
          if ($isListNode(node) && node.getListType() === 'number') {
            continue
          }

          const parent = node.getParent()

          if ($isListNode(parent) && parent.getListType() === 'number') {
            continue
          }

          const parentParent = parent?.getParent()
          // Example scenario: Node = textNode, parent = listItemNode, parentParent = listNode
          if ($isListNode(parentParent) && parentParent.getListType() === 'number') {
            continue
          }

          return false
        }
        return true
      },
      key: 'orderedList',
      label: `Ordered List`,
      onSelect: ({ editor }) => {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
      },
      order: 10,
    },
  ]),
]

const OrderedListFeatureClient: FeatureProviderProviderClient<undefined> = (props) => {
  return {
    clientFeatureProps: props,
    feature: ({ featureProviderMap }) => {
      return {
        clientFeatureProps: props,
        markdownTransformers: [ORDERED_LIST],
        nodes: featureProviderMap.has('orderedList') ? [] : [ListNode, ListItemNode],
        plugins: featureProviderMap.has('orderedList')
          ? []
          : [
              {
                Component: LexicalListPlugin,
                position: 'normal',
              },
            ],
        slashMenu: {
          groups: [
            {
              items: [
                {
                  Icon: OrderedListIcon,
                  key: 'orderedList',
                  keywords: ['ordered list', 'ol'],
                  label: 'Ordered List',
                  onSelect: ({ editor }) => {
                    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
                  },
                },
              ],
              key: 'lists',
              label: 'Lists',
            },
          ],
        },
        toolbarFixed: {
          groups: toolbarGroups,
        },
        toolbarInline: {
          groups: toolbarGroups,
        },
      }
    },
  }
}

export const OrderedListFeatureClientComponent = createClientComponent(OrderedListFeatureClient)