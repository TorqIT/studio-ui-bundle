/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import React, { type ReactElement, type Ref, type ComponentProps, forwardRef } from 'react'
import { Draggable } from '@Pimcore/components/drag-and-drop/draggable'
import { type DragAndDropInfo } from '@Pimcore/components/drag-and-drop/droppable'
import { type Asset } from '../../asset-api-slice-enhanced'
import { type TreeNode } from '@Pimcore/components/element-tree/node/tree-node'
import { useElementTree } from '@Pimcore/components/element-tree/hooks/use-element-tree'
import { isString } from 'lodash'
import { useTranslation } from 'react-i18next'

export const withDraggable = (Component: typeof TreeNode): typeof TreeNode => {
  const DraggableNodeContent = (props: ComponentProps<typeof TreeNode>, ref: Ref<HTMLDivElement>): ReactElement => {
    const metaData: Asset | undefined = props.metaData?.asset
    const { t } = useTranslation()
    const { getSelectedNodes } = useElementTree()

    if (props.metaData?.asset === undefined) {
      return (
        <Component
          { ...props }
          ref={ ref }
        />
      )
    }

    const title = isString(metaData?.filename) && metaData?.filename !== '' ? metaData?.filename : t('home')
    const info: DragAndDropInfo = { icon: props.icon, title, type: 'asset', data: { ...metaData } }

    // Dragging a node that is part of a multi-selection drags the whole selection.
    const getInfo = (): DragAndDropInfo => {
      const selectedAssets: Asset[] = getSelectedNodes()
        .map((node) => node.metaData?.asset as Asset | undefined)
        .filter((asset): asset is Asset => asset !== undefined)
      const isPartOfSelection = selectedAssets.length > 1 && selectedAssets.some((asset) => asset.id === metaData?.id)

      if (!isPartOfSelection) {
        return info
      }

      return {
        ...info,
        title: t('element.tree.multi-select.drag-title', { count: selectedAssets.length }),
        items: selectedAssets
      }
    }

    return (
      <Draggable
        getInfo={ getInfo }
        info={ info }
      >
        <Component
          { ...props }
          ref={ ref }
        />
      </Draggable>
    )
  }

  return forwardRef(DraggableNodeContent)
}
