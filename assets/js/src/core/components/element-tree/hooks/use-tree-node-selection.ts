/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { type MouseEvent, useContext } from 'react'
import { isNil } from 'lodash'
import { TreeContext } from '../element-tree'
import { type TreeNodeProps } from '../node/tree-node'
import { getNodeIdRange } from '../node/tree-node-selection'
import { useElementTree } from './use-element-tree'

export interface UseTreeNodeSelectionProps {
  id: string
  isSelected: boolean
  treeNodeProps: TreeNodeProps
}

export interface UseTreeNodeSelectionReturn {
  /** Plain selection: this node becomes the only selected node and is opened via `onSelect`. */
  selectNode: () => void
  onClick: (event: MouseEvent<HTMLElement>) => void
  onContextMenu: (event: MouseEvent<HTMLElement>) => void
  onMouseDown: (event: MouseEvent<HTMLElement>) => void
}

/**
 * Mouse selection behaviour of a tree node: plain click selects and opens, Ctrl/Cmd+click toggles,
 * Shift+click selects the visual range from the anchor (the last plain or toggled node).
 * Modifier clicks never open the element.
 */
export const useTreeNodeSelection = ({ id, isSelected, treeNodeProps }: UseTreeNodeSelectionProps): UseTreeNodeSelectionReturn => {
  const { onSelect, onRightClick, selectionAnchor } = useContext(TreeContext)
  const { setSelectedIds, toggleSelectedId } = useElementTree()

  const setSelectionAnchor = (): void => {
    if (!isNil(selectionAnchor)) {
      selectionAnchor.current = id
    }
  }

  const selectNode = (): void => {
    setSelectedIds([id])
    setSelectionAnchor()
    onSelect?.(treeNodeProps)
  }

  const toggleNodeSelection = (): void => {
    toggleSelectedId(id)
    setSelectionAnchor()
  }

  // Falls back to a plain selection when the anchor is not rendered any more (e.g. its parent was collapsed).
  const selectNodeRange = (currentElement: HTMLElement): void => {
    const anchorId = selectionAnchor?.current ?? null
    const rangeIds = isNil(anchorId) ? null : getNodeIdRange(currentElement, anchorId, id)

    if (isNil(rangeIds)) {
      selectNode()
      return
    }

    setSelectedIds(rangeIds)
  }

  const onClick = (event: MouseEvent<HTMLElement>): void => {
    if (event.ctrlKey || event.metaKey) {
      toggleNodeSelection()
      return
    }

    if (event.shiftKey) {
      selectNodeRange(event.currentTarget)
      return
    }

    selectNode()
  }

  // Right-clicking a node outside the current selection makes it the sole selection;
  // right-clicking inside the selection keeps it, so the menu can act on all selected nodes.
  const onContextMenu = (event: MouseEvent<HTMLElement>): void => {
    if (!isSelected) {
      setSelectedIds([id])
      setSelectionAnchor()
    }

    onRightClick?.(event, treeNodeProps)
  }

  // Prevent the browser's text selection on Shift+click.
  const onMouseDown = (event: MouseEvent<HTMLElement>): void => {
    if (event.shiftKey) {
      event.preventDefault()
    }
  }

  return { selectNode, onClick, onContextMenu, onMouseDown }
}
