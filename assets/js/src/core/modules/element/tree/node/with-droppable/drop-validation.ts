/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { type DragAndDropInfo } from '@Pimcore/components/drag-and-drop/droppable'
import { isNil } from 'lodash'

export interface DroppableElement {
  id: number
  fullPath?: string
}

/** The elements carried by a drag: every selected element for a multi-select drag, otherwise the dragged one. */
export const getDragSources = <T>(info: DragAndDropInfo): T[] => {
  return (info.items ?? [info.data]) as T[]
}

const withTrailingSlash = (path: string): string => path.endsWith('/') ? path : `${path}/`

/** Whether `path` is `ancestorPath` itself or lies somewhere below it. */
export const isSameOrDescendantPath = (path: string, ancestorPath: string): boolean => {
  return withTrailingSlash(path).startsWith(withTrailingSlash(ancestorPath))
}

/**
 * An element can never be dropped onto itself or into its own subtree. The backend only rejects
 * the first case, so the check runs here for every dragged element before anything is sent.
 */
export const canDropSourcesOnTarget = (sources: DroppableElement[], target: DroppableElement): boolean => {
  if (sources.length === 0) {
    return false
  }

  return sources.every((source) => {
    if (source.id === target.id) {
      return false
    }

    if (isNil(source.fullPath) || isNil(target.fullPath)) {
      return true
    }

    return !isSameOrDescendantPath(target.fullPath, source.fullPath)
  })
}
