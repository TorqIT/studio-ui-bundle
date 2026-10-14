/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { isNil, uniq } from 'lodash'
import { useAppDispatch } from '@sdk/app'
import { type ElementType } from '@Pimcore/types/enums/element/element-type'
import { type Element } from '@Pimcore/modules/element/element-helper'
import { markNodeDeleting, refreshSourceNode, refreshTargetNode } from '@Pimcore/components/element-tree/element-tree-slice'
import { useElementApi } from '@Pimcore/modules/element/hooks/use-element-api'
import { useExecutionEngine } from '@Pimcore/modules/execution-engine/hooks/use-execution-engine'
import { type BatchMoveElement } from '@Pimcore/modules/execution-engine/jobs/batch-move/batch-move-payload'
import { ElementBatchMoveJob } from '@Pimcore/modules/execution-engine/jobs/batch-move/element-batch-move-job'
import { useSorting } from '../sorting/use-sorting'
import { useCopyPaste } from './use-copy-paste'

type ElementPartial = Pick<Element, 'id' | 'parentId'>

export interface MoveManyProps {
  currentElements: ElementPartial[]
  targetElement: ElementPartial
  /**
   * Position of the first element among the target's children (index-sorted parents only).
   * The following elements are placed right after it, keeping their relative order.
   */
  indexStart?: number
}

export interface UseBatchMoveHookReturn {
  moveMany: (props: MoveManyProps) => Promise<void>
}

/**
 * Moves several elements under one target with a single tree refresh at the end.
 *
 * Data objects and assets go through one multi-element patch, which the backend executes as an
 * execution-engine job (201 + jobRunId) — the tree waits for that job instead of refreshing on the
 * HTTP response. Documents have no batch patch endpoint and are moved one request at a time.
 */
export const useBatchMove = (elementType: ElementType): UseBatchMoveHookReturn => {
  const dispatch = useAppDispatch()
  const executionEngine = useExecutionEngine()
  const { elementPatch } = useElementApi(elementType)
  const { move } = useCopyPaste(elementType)
  const { move: moveByIndex } = useSorting(elementType)

  const setDeleting = (elements: ElementPartial[], isDeleting: boolean): void => {
    elements.forEach((element) => {
      dispatch(markNodeDeleting({ nodeId: String(element.id), elementType, isDeleting }))
    })
  }

  const refreshAffectedNodes = (elements: ElementPartial[], targetElement: ElementPartial): void => {
    uniq(elements.map((element) => String(element.parentId))).forEach((parentId) => {
      dispatch(refreshSourceNode({ nodeId: parentId, elementType }))
    })
    dispatch(refreshTargetNode({ nodeId: String(targetElement.id), elementType }))
  }

  const toBatchMoveElements = (elements: ElementPartial[], indexStart?: number): BatchMoveElement[] => {
    return elements.map((element, position) => ({
      id: element.id,
      parentId: element.parentId,
      index: isNil(indexStart) ? undefined : indexStart + position
    }))
  }

  const moveManyAsJob = async (elementType: 'asset' | 'data-object', elements: BatchMoveElement[], targetElement: ElementPartial): Promise<void> => {
    const job = new ElementBatchMoveJob({
      elementType,
      elements,
      targetId: targetElement.id,
      onFinish: async () => { refreshAffectedNodes(elements, targetElement) },
      onFailure: async () => { setDeleting(elements, false) }
    })

    await executionEngine.runJob(job)
  }

  // Documents only have a single-element update endpoint: one request per element, one refresh.
  const moveManySequentially = async (elements: BatchMoveElement[], targetElement: ElementPartial): Promise<void> => {
    let success = true

    for (const element of elements) {
      const moved = await elementPatch({
        body: { data: [{ id: element.id, parentId: targetElement.id, index: element.index }] }
      })

      success = success && moved
    }

    if (!success) {
      setDeleting(elements, false)
    }

    refreshAffectedNodes(elements, targetElement)
  }

  const moveMany = async (props: MoveManyProps): Promise<void> => {
    const { targetElement, indexStart } = props
    const currentElements = props.currentElements.filter((element) => element.id !== targetElement.id)

    if (currentElements.length === 0) {
      return
    }

    // A single element keeps the existing synchronous paths (a one-element patch is not a job).
    if (currentElements.length === 1) {
      const [currentElement] = currentElements

      if (isNil(indexStart)) {
        await move({ currentElement, targetElement })
      } else {
        await moveByIndex({ currentElement, targetElement: { id: currentElement.id, parentId: targetElement.id }, newIndex: indexStart })
      }
      return
    }

    const elements = toBatchMoveElements(currentElements, indexStart)
    setDeleting(elements, true)

    if (elementType === 'asset' || elementType === 'data-object') {
      await moveManyAsJob(elementType, elements, targetElement)
      return
    }

    await moveManySequentially(elements, targetElement)
  }

  return { moveMany }
}
