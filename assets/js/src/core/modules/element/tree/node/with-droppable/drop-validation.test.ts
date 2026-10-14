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
import { canDropSourcesOnTarget, getDragSources, isSameOrDescendantPath } from './drop-validation'

const element = (id: number, fullPath?: string): { id: number, fullPath?: string } => ({ id, fullPath })

const dragInfo = (data: unknown, items?: unknown[]): DragAndDropInfo => ({
  type: 'data-object',
  icon: { value: 'folder' },
  title: 'drag',
  data,
  items
})

describe('drop-validation: getDragSources', () => {
  it('returns the dragged element for a single drag', () => {
    expect(getDragSources(dragInfo(element(1)))).toEqual([element(1)])
  })

  it('returns every carried element for a multi-select drag', () => {
    expect(getDragSources(dragInfo(element(1), [element(1), element(2)]))).toEqual([element(1), element(2)])
  })
})

describe('drop-validation: isSameOrDescendantPath', () => {
  it.each([
    ['/a/b', '/a', true],
    ['/a', '/a', true],
    ['/a/', '/a', true],
    ['/ab', '/a', false],
    ['/a', '/a/b', false],
    ['/x/a/b', '/a', false]
  ])('%s within %s → %s', (path, ancestor, expected) => {
    expect(isSameOrDescendantPath(path, ancestor)).toBe(expected)
  })
})

describe('drop-validation: canDropSourcesOnTarget', () => {
  const folder = element(1, '/folder')
  const child = element(2, '/folder/child')
  const sibling = element(3, '/sibling')

  it('allows dropping unrelated elements onto a target', () => {
    expect(canDropSourcesOnTarget([sibling, child], folder)).toBe(true)
  })

  it('rejects dropping an element onto itself', () => {
    expect(canDropSourcesOnTarget([sibling, folder], folder)).toBe(false)
  })

  it('rejects dropping an element into its own subtree', () => {
    expect(canDropSourcesOnTarget([folder], child)).toBe(false)
    expect(canDropSourcesOnTarget([sibling, folder], child)).toBe(false)
  })

  it('does not reject when paths are unknown, apart from the identity check', () => {
    expect(canDropSourcesOnTarget([element(5)], element(6))).toBe(true)
    expect(canDropSourcesOnTarget([element(5)], element(5))).toBe(false)
  })

  it('rejects an empty drag', () => {
    expect(canDropSourcesOnTarget([], folder)).toBe(false)
  })
})
