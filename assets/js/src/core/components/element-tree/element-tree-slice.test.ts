/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

// antd-style is untranspiled ESM — the icon component pulled in via the lock action goes through this factory
jest.mock('@Pimcore/modules/ant-design/styles/create-styles', () => ({
  createStyles: () => () => ({ styles: {}, cx: (...classNames: unknown[]) => classNames.filter(Boolean).join(' '), theme: {} })
}))

jest.mock('@sdk/app', () => ({
  injectSliceWithState: jest.fn()
}))

// eslint-disable-next-line import/first
import { type Reducer, type UnknownAction } from '@reduxjs/toolkit'
// eslint-disable-next-line import/first
import { injectSliceWithState, type RootState } from '@sdk/app'
// eslint-disable-next-line import/first
import {
  clearSelectedNodeIds,
  type InternalNodeState,
  renameNode,
  selectSelectedNodeIds,
  selectSelectedNodes,
  setSelectedNodeIds,
  toggleSelectedNodeId,
  type TreeNode,
  updateNodesByParentId
} from './element-tree-slice'

type TreesState = Record<string, { nodes: Record<string, InternalNodeState> }>

interface SliceLike {
  name: string
  reducer: Reducer<TreesState>
}

const injectSliceWithStateMock = injectSliceWithState as unknown as jest.Mock
const slice = injectSliceWithStateMock.mock.calls
  .map((call: unknown[]) => call[0] as SliceLike)
  .find((registeredSlice) => registeredSlice.name === 'trees')!

const treeId = 'test-tree'

const permissions = {
  list: true,
  view: true,
  publish: false,
  unpublish: false,
  delete: false,
  rename: false,
  create: false,
  settings: false,
  versions: false,
  properties: false,
  save: false,
  localizedEdit: null,
  localizedView: null
}

const createNode = (id: string, parentId: string): TreeNode => ({
  id,
  parentId,
  elementType: 'data-object',
  icon: { type: 'name', value: 'folder' },
  label: `node-${id}`,
  permissions,
  locked: null,
  isLocked: false,
  internalKey: `${parentId}-${id}`
})

// The selectors take the app's root state; the tree slice is the only part they read.
const rootStateOf = (trees: TreesState): RootState => {
  const rootState = { trees }
  return rootState as unknown as RootState
}

const dispatchAll = (actions: UnknownAction[]): TreesState => {
  let state = slice.reducer(undefined, { type: '@@INIT' })
  actions.forEach((action) => {
    state = slice.reducer(state, action)
  })
  return state
}

describe('element-tree-slice: renameNode', () => {
  it('updates the label and the real key of the renamed node', () => {
    const state = dispatchAll([
      updateNodesByParentId({
        treeId,
        parentId: '1',
        nodes: [{ ...createNode('10', '1'), label: 'car - test', realKey: 'car' }],
        total: 1
      }),
      renameNode({ nodeId: '10', elementType: 'data-object', newLabel: 'new-car' })
    ])

    const nodeProps = state[treeId].nodes['10'].treeNodeProps
    expect(nodeProps?.label).toBe('new-car')
    expect(nodeProps?.realKey).toBe('new-car')
  })
})

describe('element-tree-slice: selection', () => {
  const loadChildren = (nodes: TreeNode[], parentId = '1'): UnknownAction =>
    updateNodesByParentId({ treeId, parentId, nodes, total: nodes.length })

  const threeChildren = [createNode('10', '1'), createNode('11', '1'), createNode('12', '1')]

  const selectedIdsOf = (state: TreesState): string[] => selectSelectedNodeIds(rootStateOf(state), treeId)
  const selectedFlagsOf = (state: TreesState): Record<string, boolean | undefined> =>
    Object.fromEntries(Object.entries(state[treeId].nodes).map(([nodeId, node]) => [nodeId, node.isSelected]))

  it('keeps the selected ids as a list and mirrors them into the per-node flags', () => {
    const state = dispatchAll([
      loadChildren(threeChildren),
      setSelectedNodeIds({ treeId, selectedNodeIds: ['10', '12'] })
    ])

    expect(selectedIdsOf(state)).toEqual(['10', '12'])
    expect(selectedFlagsOf(state)).toMatchObject({ 10: true, 11: false, 12: true })
  })

  it('replaces the selection on setSelectedNodeIds and only unflags nodes that left it', () => {
    const state = dispatchAll([
      loadChildren(threeChildren),
      setSelectedNodeIds({ treeId, selectedNodeIds: ['10', '11'] }),
      setSelectedNodeIds({ treeId, selectedNodeIds: ['11', '12', '12'] })
    ])

    expect(selectedIdsOf(state)).toEqual(['11', '12'])
    expect(selectedFlagsOf(state)).toMatchObject({ 10: false, 11: true, 12: true })
  })

  it('toggles a node in and out of the selection, preserving selection order', () => {
    const added = dispatchAll([
      loadChildren(threeChildren),
      setSelectedNodeIds({ treeId, selectedNodeIds: ['11'] }),
      toggleSelectedNodeId({ treeId, nodeId: '10' })
    ])
    expect(selectedIdsOf(added)).toEqual(['11', '10'])
    expect(added[treeId].nodes['10'].isSelected).toBe(true)

    const removed = slice.reducer(added, toggleSelectedNodeId({ treeId, nodeId: '11' }))
    expect(selectedIdsOf(removed)).toEqual(['10'])
    expect(removed[treeId].nodes['11'].isSelected).toBe(false)
  })

  it('clears the selection', () => {
    const state = dispatchAll([
      loadChildren(threeChildren),
      setSelectedNodeIds({ treeId, selectedNodeIds: ['10', '11'] }),
      clearSelectedNodeIds({ treeId })
    ])

    expect(selectedIdsOf(state)).toEqual([])
    expect(selectedFlagsOf(state)).toMatchObject({ 10: false, 11: false, 12: false })
  })

  it('drops selected ids whose nodes disappear when a parent is reloaded', () => {
    const state = dispatchAll([
      loadChildren(threeChildren),
      setSelectedNodeIds({ treeId, selectedNodeIds: ['10', '11', '12'] }),
      // node 11 was deleted or moved away; the parent comes back without it
      loadChildren([createNode('10', '1'), createNode('12', '1')])
    ])

    expect(selectedIdsOf(state)).toEqual(['10', '12'])
  })

  it('resolves the selected nodes in selection order and skips ids without node data', () => {
    const state = dispatchAll([
      loadChildren(threeChildren),
      setSelectedNodeIds({ treeId, selectedNodeIds: ['12', '10', 'unknown'] })
    ])

    const selectedNodes = selectSelectedNodes(rootStateOf(state), treeId)
    expect(selectedNodes.map((node) => node.id)).toEqual(['12', '10'])
  })

  it('returns a stable empty selection for an unknown tree', () => {
    const state = dispatchAll([])

    expect(selectedIdsOf(state)).toBe(selectSelectedNodeIds(rootStateOf(state), 'other-tree'))
    expect(selectSelectedNodes(rootStateOf(state), treeId)).toEqual([])
  })
})
