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

export interface BatchMoveElement {
  id: number
  parentId: number
  /** Target position among the new siblings; only meaningful for index-sorted parents. */
  index?: number
}

export interface BatchMovePatchItem {
  id: number
  parentId: number
  index?: number
}

/** One patch entry per element: new parent for all, plus the index where the drop asked for one. */
export const buildBatchMovePayload = (elements: BatchMoveElement[], targetId: number): BatchMovePatchItem[] => {
  return elements.map((element) => ({
    id: element.id,
    parentId: targetId,
    ...(isNil(element.index) ? {} : { index: element.index })
  }))
}
