/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { isNil } from 'lodash'

export const TREE_NODE_ID_ATTRIBUTE = 'data-node-id'

/** Ids of all rendered tree nodes of the tree that contains `from`, in visual (DOM) order. */
export function getVisibleNodeIds (from: HTMLElement): string[] {
  const tree = from.closest('.tree')
  if (isNil(tree)) return []

  return Array.from(tree.querySelectorAll<HTMLElement>(`.tree-node__content-inner[${TREE_NODE_ID_ATTRIBUTE}]`))
    .map((element) => element.getAttribute(TREE_NODE_ID_ATTRIBUTE))
    .filter((nodeId): nodeId is string => !isNil(nodeId))
}

/**
 * Node ids between `anchorId` and `currentId` (inclusive) in visual order, or `null` when either
 * node is not rendered (e.g. the anchor's parent was collapsed in the meantime).
 */
export function getNodeIdRange (from: HTMLElement, anchorId: string, currentId: string): string[] | null {
  const visibleNodeIds = getVisibleNodeIds(from)
  const anchorIndex = visibleNodeIds.indexOf(anchorId)
  const currentIndex = visibleNodeIds.indexOf(currentId)

  if (anchorIndex === -1 || currentIndex === -1) {
    return null
  }

  const [start, end] = anchorIndex < currentIndex ? [anchorIndex, currentIndex] : [currentIndex, anchorIndex]

  return visibleNodeIds.slice(start, end + 1)
}
