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
import { type DataObject } from '@Pimcore/modules/data-object/data-object-api-slice-enhanced'
import { isUndefined } from 'lodash'
import { useDndAllowed } from '@Pimcore/modules/element/tree/node/with-droppable/use-dnd-allowed'
import { canDropSourcesOnTarget, getDragSources } from '@Pimcore/modules/element/tree/node/with-droppable/drop-validation'
import { HotspotDroppable, type HotspotDroppableProps } from '@Pimcore/components/drag-and-drop/hotspot-droppable'
import { useElementTreeNode } from '@Pimcore/components/element-tree/hooks/use-element-tree-node'
import { useTreeClassRestriction } from '../../hooks/use-tree-class-restriction'

interface OnSortingDropProps {
  info: DragAndDropInfo
  position?: 'top' | 'bottom'
}

export const withDroppable = (Component: typeof TreeNode): typeof TreeNode => {
  const DroppableNodeContent = (props: TreeNodeProps, ref: Ref<HTMLDivElement>): ReactElement => {
    const { moveMany } = useBatchMove('data-object')
    const { isSourceAllowed, isTargetAllowed } = useDndAllowed()
    const { isClassAllowed } = useTreeClassRestriction()
    const parentNode = useElementTreeNode(props.parentId ?? '-1')
    const hasParent = parentNode !== undefined
    let sortingMode = 'keyed'

    if (hasParent) {
      sortingMode = parentNode.treeNodeProps?.metaData?.dataObject?.childrenSortBy ?? 'keyed'
    }

    if (props.metaData?.dataObject === undefined) {
      return (
        <Component { ...props } />
      )
    }

    const targetObject: DataObject = props.metaData.dataObject

    if (!isTargetAllowed(targetObject)) {
      return (
        <Component { ...props } />
      )
    }

    const isSourceObjectAllowed = (sourceObject: DataObject): boolean => {
      return sourceObject.type !== 'variant' && isSourceAllowed(sourceObject) && isClassAllowed(sourceObject)
    }

    // Every dragged element has to be allowed; a drop into a folder also must not target one of
    // the dragged elements or their subtrees.
    const canDrop = (sourceObjects: DataObject[], target: DataObject): boolean => {
      return sourceObjects.every(isSourceObjectAllowed) && canDropSourcesOnTarget(sourceObjects, target)
    }

    const toMoveElements = (sourceObjects: DataObject[]): Array<{ id: number, parentId: number }> => {
      return sourceObjects.map((sourceObject) => ({ id: sourceObject.id, parentId: sourceObject.parentId }))
    }

    const onDrop: DroppableProps['onDrop'] = (info) => {
      const sourceObjects = getDragSources<DataObject>(info)

      if (!canDrop(sourceObjects, targetObject) || !isTargetAllowed(targetObject)) {
        return
      }

      moveMany({
        currentElements: toMoveElements(sourceObjects),
        targetElement: { id: targetObject.id, parentId: targetObject.parentId }
      }).catch(() => {
        trackError(new GeneralError('Items could not be moved'))
      })
    }

    // Sorting drops place the dragged elements next to the target, inside the target's parent.
    const onSortingDrop = (props: OnSortingDropProps): void => {
      const { info, position = 'top' } = props
      const sourceObjects = getDragSources<DataObject>(info)
      const newParent = { id: targetObject.parentId, fullPath: undefined }

      if (!sourceObjects.every(isSourceObjectAllowed) || !canDropSourcesOnTarget(sourceObjects, newParent) || !isTargetAllowed(targetObject)) {
        return
      }

      moveMany({
        currentElements: toMoveElements(sourceObjects),
        targetElement: { id: targetObject.parentId, parentId: targetObject.parentId },
        indexStart: position === 'top' ? targetObject.index : targetObject.index + 1
      }).catch(() => {
        trackError(new GeneralError('Items could not be moved'))
      })
    }

    const checkForValidContext: DroppableProps['isValidContext'] = (context) => {
      return context.type === 'data-object' && getDragSources<DataObject>(context).every((sourceObject) => sourceObject.type !== 'variant')
    }

    const checkForValidData: DroppableProps['isValidData'] = (info) => {
      return info.type === 'data-object' &&
        targetObject.type !== 'variant' &&
        isTargetAllowed(targetObject) &&
        canDrop(getDragSources<DataObject>(info), targetObject)
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

    if (sortingMode === 'index') {
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
