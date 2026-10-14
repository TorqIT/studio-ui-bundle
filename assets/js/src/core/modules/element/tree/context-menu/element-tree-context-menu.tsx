/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import React from 'react'
import { type TreeNodeProps } from '@Pimcore/components/element-tree/node/tree-node'
import { useSelectedTreeNodes } from '@Pimcore/components/element-tree/hooks/use-selected-tree-nodes'
import { Menu } from '@Pimcore/components/menu/menu'
import { createContextMenuContainerTestId } from '@Pimcore/utils/test-id-generator'
import { type TreeContextMenuProps } from '@Pimcore/modules/app/context-menu-registry/context-types'
import { useContextMenuSlot } from '@Pimcore/modules/app/context-menu-registry/use-context-menu-slot'
import { type ElementType } from '@Pimcore/types/enums/element/element-type'

export interface ElementTreeContextMenuProps {
  node: TreeNodeProps
  slotName: string
  elementType: ElementType
}

interface ElementTreeContextMenuItemsProps {
  slotName: string
  context: TreeContextMenuProps
  dataTestId: string
}

const ElementTreeContextMenuItems = ({ slotName, context, dataTestId }: ElementTreeContextMenuItemsProps): React.JSX.Element => {
  const items = useContextMenuSlot(slotName, context)

  return (
    <Menu
      dataTestId={ dataTestId }
      items={ items }
    />
  )
}

/**
 * Context menu of a tree node. When the node is part of a multi-selection the registry only
 * contributes multi-selection aware items (classic admin parity: just "Delete") and the menu
 * receives every selected node as `selectedNodes`.
 */
export const ElementTreeContextMenu = ({ node, slotName, elementType }: ElementTreeContextMenuProps): React.JSX.Element => {
  const selectedNodes = useSelectedTreeNodes()
  const isMultiSelection = selectedNodes.length > 1 && selectedNodes.some((selectedNode) => selectedNode.id === node.id)

  const context: TreeContextMenuProps = {
    target: node,
    selectedNodes: isMultiSelection ? selectedNodes : undefined,
    onComplete: () => {}
  }

  // The providers call hooks while building their items, so switching between the single- and
  // multi-selection provider sets must remount the item list rather than re-render it.
  return (
    <ElementTreeContextMenuItems
      context={ context }
      dataTestId={ createContextMenuContainerTestId(elementType, node.id) }
      key={ isMultiSelection ? 'multi-selection' : 'single-selection' }
      slotName={ slotName }
    />
  )
}
