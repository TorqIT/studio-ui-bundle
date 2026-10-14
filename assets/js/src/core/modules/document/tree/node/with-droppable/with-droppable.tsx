/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { type TreeNode, type TreeNodeProps } from '@Pimcore/components/element-tree/node/tree-node'
import React, { forwardRef, type ReactElement, type Ref } from 'react'
import { type DragAndDropInfo, type DroppableProps } from '@Pimcore/components/drag-and-drop/droppable'
import { useBatchMove } from '@Pimcore/modules/element/actions/copy-paste/use-batch-move'
import trackError, { GeneralError } from '@Pimcore/modules/app/error-handler'
import { type Document } from '@Pimcore/modules/document/document-api-slice-enhanced'
import { isUndefined } from 'lodash'
import { useDndAllowed } from '@Pimcore/modules/element/tree/node/with-droppable/use-dnd-allowed'
import { canDropSourcesOnTarget, getDragSources } from '@Pimcore/modules/element/tree/node/with-droppable/drop-validation'
import { HotspotDroppable, type HotspotDroppableProps } from '@Pimcore/components/drag-and-drop/hotspot-droppable'

interface OnSortingDropProps {
  info: DragAndDropInfo
  position?: 'top' | 'bottom'
}

export const withDroppable = (Component: typeof TreeNode): typeof TreeNode => {
  const DroppableNodeContent = (props: TreeNodeProps, ref: Ref<HTMLDivElement>): ReactElement => {
    const { moveMany } = useBatchMove('document')
    const { isSourceAllowed, isTargetAllowed } = useDndAllowed()

    if (props.metaData?.document === undefined) {
      return (
        <Component { ...props } />
      )
    }

    const targetDocument: Document = props.metaData.document

    if (!isTargetAllowed(targetDocument)) {
      return (
        <Component { ...props } />
      )
    }

    // Every dragged document has to be allowed; a drop into a document also must not target one
    // of the dragged documents or their subtrees.
    const canDrop = (sourceDocuments: Document[], target: { id: number, fullPath?: string }): boolean => {
      return sourceDocuments.every((sourceDocument) => isSourceAllowed(sourceDocument)) && canDropSourcesOnTarget(sourceDocuments, target)
    }

    const toMoveElements = (sourceDocuments: Document[]): Array<{ id: number, parentId: number }> => {
      return sourceDocuments.map((sourceDocument) => ({ id: sourceDocument.id, parentId: sourceDocument.parentId }))
    }

    const onDrop: DroppableProps['onDrop'] = (info) => {
      const sourceDocuments = getDragSources<Document>(info)

      if (!canDrop(sourceDocuments, targetDocument) || !isTargetAllowed(targetDocument)) {
        return
      }

      moveMany({
        currentElements: toMoveElements(sourceDocuments),
        targetElement: { id: targetDocument.id, parentId: targetDocument.parentId }
      }).catch(() => {
        trackError(new GeneralError('Items could not be moved'))
      })
    }

    const checkForValidContext: DroppableProps['isValidContext'] = (context) => {
      return context.type === 'document'
    }

    const checkForValidData: DroppableProps['isValidData'] = (info) => {
      return info.type === 'document' && canDrop(getDragSources<Document>(info), targetDocument) && isTargetAllowed(targetDocument)
    }

    // Sorting drops place the dragged documents next to the target, inside the target's parent.
    const onSortingDrop = (props: OnSortingDropProps): void => {
      const { info, position = 'top' } = props
      const sourceDocuments = getDragSources<Document>(info)

      if (!canDrop(sourceDocuments, { id: targetDocument.parentId }) || !isTargetAllowed(targetDocument)) {
        return
      }

      moveMany({
        currentElements: toMoveElements(sourceDocuments),
        targetElement: { id: targetDocument.parentId, parentId: targetDocument.parentId },
        indexStart: position === 'top' ? targetDocument.index : targetDocument.index + 1
      }).catch(() => {
        trackError(new GeneralError('Items could not be moved'))
      })
    }

    let hotspots: HotspotDroppableProps['hotspots'] = [
      {
        id: 'drop-middle',
        isValidContext: checkForValidContext,
        isValidData: checkForValidData,
        position: { x: '0', y: '0%', width: '100%', height: '100%' },
        onDrop
      }
    ]

    if (props.isRoot !== true) {
      hotspots = [
        {
          id: 'sorting-top',
          className: 'dnd__sorting dnd__sorting--top',
          isValidContext: checkForValidContext,
          isValidData: checkForValidData,
          position: { x: 0, y: 0, width: '100%', height: '30%' },
          onDrop: (info) => { onSortingDrop({ info, position: 'top' }) }
        },
        {
          id: 'drop-middle',
          isValidContext: checkForValidContext,
          isValidData: checkForValidData,
          position: { x: '0', y: '30%', width: '100%', height: '40%' },
          onDrop
        },
        {
          id: 'sorting-bottom',
          className: 'dnd__sorting dnd__sorting--bottom',
          isValidContext: checkForValidContext,
          isValidData: checkForValidData,
          position: { x: 0, y: '70%', width: '100%', height: '30%' },
          onDrop: (info) => { onSortingDrop({ info, position: 'bottom' }) }
        }
      ]
    }

    return (
      <Component
        { ...props }
        ref={ ref }
        wrapNode={ (children) => (
          <HotspotDroppable
            disableDndActiveIndicator
            hotspots={ hotspots }
          >
            {!isUndefined(props.wrapNode) ? props.wrapNode(children) : children}
          </HotspotDroppable>
        ) }
      />
    )
  }

  return forwardRef(DroppableNodeContent)
}
