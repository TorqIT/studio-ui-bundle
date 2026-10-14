/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { buildBatchMovePayload } from './batch-move-payload'

describe('batch-move-payload', () => {
  it('re-parents every element to the target in one payload', () => {
    expect(buildBatchMovePayload([{ id: 10, parentId: 1 }, { id: 11, parentId: 2 }], 7)).toEqual([
      { id: 10, parentId: 7 },
      { id: 11, parentId: 7 }
    ])
  })

  it('carries the requested index only where one was given', () => {
    expect(buildBatchMovePayload([{ id: 10, parentId: 1, index: 3 }, { id: 11, parentId: 1, index: 4 }, { id: 12, parentId: 1 }], 1)).toEqual([
      { id: 10, parentId: 1, index: 3 },
      { id: 11, parentId: 1, index: 4 },
      { id: 12, parentId: 1 }
    ])
  })
})
