/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { type RootState } from '@sdk/app'
import { useSelector } from 'react-redux'
import { useTreeId } from '@Pimcore/components/element-tree/provider/tree-id-provider/use-tree-id'
import { selectSelectedNodes, type TreeNode } from '../element-tree-slice'

/**
 * Subscribing variant of `useElementTree().getSelectedNodes()` for components that must
 * re-render when the selection changes (e.g. the tree context menu).
 */
export const useSelectedTreeNodes = (): TreeNode[] => {
  const { treeId } = useTreeId()

  return useSelector((state: RootState) => selectSelectedNodes(state, treeId))
}
