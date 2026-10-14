/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import React, { forwardRef, type Ref, type ReactElement } from 'react'
import { Draggable } from '@Pimcore/components/drag-and-drop/draggable'
import { type DragAndDropInfo } from '@Pimcore/components/drag-and-drop/droppable'
import { type DataObject } from '../../data-object-api-slice-enhanced'
import { type TreeNode, type TreeNodeProps } from '@Pimcore/components/element-tree/node/tree-node'
import { useElementTree } from '@Pimcore/components/element-tree/hooks/use-element-tree'
import { isString } from 'lodash'
import { useTranslation } from 'react-i18next'

export const withDraggable = (Component: typeof TreeNode): typeof TreeNode => {
  const DraggableNodeContent = (props: TreeNodeProps, ref: Ref<HTMLDivElement>): ReactElement => {
    const metaData: DataObject | undefined = props.metaData.dataObject
    const { t } = useTranslation()
    const { getSelectedNodes } = useElementTree()

    if (props.metaData?.dataObject === undefined) {
      return (
        <Component { ...props } />
      )
    }

    const title = isString(metaData?.key) && metaData?.key !== '' ? metaData?.key : t('home')
    const info: DragAndDropInfo = { icon: props.icon, title, type: 'data-object', data: { ...metaData } }

    // Dragging a node that is part of a multi-selection drags the whole selection.
    const getInfo = (): DragAndDropInfo => {
      const selectedObjects: DataObject[] = getSelectedNodes()
        .map((node) => node.metaData?.dataObject as DataObject | undefined)
        .filter((dataObject): dataObject is DataObject => dataObject !== undefined)
      const isPartOfSelection = selectedObjects.length > 1 && selectedObjects.some((dataObject) => dataObject.id === metaData?.id)

      if (!isPartOfSelection) {
        return info
      }

      return {
        ...info,
        title: t('element.tree.multi-select.drag-title', { count: selectedObjects.length }),
        items: selectedObjects
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
