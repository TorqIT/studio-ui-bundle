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
import { defaultProps, type TreeNodeProps } from '@Pimcore/components/element-tree/node/tree-node'
import { contextMenuConfig } from '@Pimcore/modules/app/context-menu-registry/context-menu-config'
import { ElementTreeContextMenu } from '@Pimcore/modules/element/tree/context-menu/element-tree-context-menu'

export interface DataObjectTreeContextMenuProps {
  node: TreeNodeProps
}

export const DataObjectTreeContextMenu = (props: DataObjectTreeContextMenuProps): React.JSX.Element => {
  return (
    <ElementTreeContextMenu
      elementType="data-object"
      node={ props.node ?? defaultProps }
      slotName={ contextMenuConfig.dataObjectTree.name }
    />
  )
}
