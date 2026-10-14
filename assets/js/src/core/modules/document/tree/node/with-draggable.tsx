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
import { type Document } from '../../document-api-slice-enhanced'
import { type TreeNode, type TreeNodeProps } from '@Pimcore/components/element-tree/node/tree-node'
import { useElementTree } from '@Pimcore/components/element-tree/hooks/use-element-tree'
import { useTranslation } from 'react-i18next'
import { isString, isUndefined } from 'lodash'

export const withDraggable = (Component: typeof TreeNode): typeof TreeNode => {
  const DraggableNodeContent = (props: TreeNodeProps, ref: Ref<HTMLDivElement>): ReactElement => {
    const metaData: Document | undefined = props.metaData.document
    const { t } = useTranslation()
    const { getSelectedNodes } = useElementTree()

    if (props.metaData?.document === undefined) {
      return (
        <Component { ...props } />
      )
    }

    const title = isString(metaData?.key) && metaData?.key !== '' ? metaData?.key : t('home')
    const info: DragAndDropInfo = { icon: props.icon, title, type: 'document', data: { ...metaData } }

    // Dragging a node that is part of a multi-selection drags the whole selection.
    const getInfo = (): DragAndDropInfo => {
      const selectedDocuments = getSelectedNodes()
        .map((node) => node.metaData?.document as Document | undefined)
        .filter((document): document is Document => !isUndefined(document))
      const isPartOfSelection = selectedDocuments.length > 1 && selectedDocuments.some((document) => document.id === metaData?.id)

      if (!isPartOfSelection) {
        return info
      }

      return {
        ...info,
        title: t('element.tree.multi-select.drag-title', { count: selectedDocuments.length }),
        items: selectedDocuments
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
