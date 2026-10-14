/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { type ItemType } from '@Pimcore/components/dropdown/dropdown'
import { ContextMenuRegistry, type ContextMenuItemProvider } from './context-menu-registry'

const mockRegistry = new ContextMenuRegistry()

jest.mock('@Pimcore/app/depency-injection', () => ({
  container: { get: () => mockRegistry }
}))

jest.mock('@Pimcore/modules/app/error-handler', () => ({
  __esModule: true,
  default: jest.fn(),
  GeneralError: class GeneralError extends Error {}
}))

// eslint-disable-next-line import/first
import { useContextMenuSlot } from './use-context-menu-slot'

const slotName = 'test.tree'

const provider = (name: string, supportsMultiSelection?: boolean): ContextMenuItemProvider => ({
  name,
  supportsMultiSelection,
  useMenuItem: (): ItemType => ({ key: name, label: name })
})

const keysOf = (items: ItemType[]): string[] => items.map((item) => String(item?.key))

describe('useContextMenuSlot: multi-selection', () => {
  beforeAll(() => {
    mockRegistry.registerToSlot(slotName, provider('rename'))
    mockRegistry.registerToSlot(slotName, provider('delete'))
    mockRegistry.registerToSlot(slotName, provider('batch-delete', true))
  })

  it('offers every provider for a single node', () => {
    const target = { id: '1' }

    expect(keysOf(useContextMenuSlot(slotName, { target }))).toEqual(['rename', 'delete', 'batch-delete'])
    expect(keysOf(useContextMenuSlot(slotName, { target, selectedNodes: [target] }))).toEqual(['rename', 'delete', 'batch-delete'])
  })

  it('only offers multi-selection aware providers while several nodes are selected', () => {
    const selectedNodes = [{ id: '1' }, { id: '2' }]

    expect(keysOf(useContextMenuSlot(slotName, { target: selectedNodes[0], selectedNodes }))).toEqual(['batch-delete'])
  })
})
