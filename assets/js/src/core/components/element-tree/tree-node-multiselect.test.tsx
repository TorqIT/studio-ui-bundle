/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

// antd-style is untranspiled ESM — every `.styles.ts` in the render tree goes through this
// factory, so stubbing it here avoids mocking each `.styles.ts` file individually
jest.mock('@Pimcore/modules/ant-design/styles/create-styles', () => ({
  createStyles: () => () => ({ styles: {}, cx: (...classNames: unknown[]) => classNames.filter(Boolean).join(' '), theme: {} })
}))

jest.mock('@Pimcore/components/icon/icon', () => ({
  Icon: (): null => null
}))

// tree-node-content pulls in the whole sdk component index (untranspiled antd ESM) — stub it with a label renderer
jest.mock('@Pimcore/components/element-tree/node/content/tree-node-content', () => ({
  TreeNodeContent: ({ node }: { node: { label: string } }): string => node.label
}))

// the sdk app module re-exports the router and with it large parts of the app — the tree only needs the store bindings
jest.mock('@sdk/app', () => {
  const appStore = jest.requireActual('@Pimcore/app/store')
  return {
    injectSliceWithState: appStore.injectSliceWithState,
    useAppDispatch: appStore.useAppDispatch
  }
})

// eslint-disable-next-line import/first
import '@testing-library/jest-dom'
// eslint-disable-next-line import/first
import React from 'react'
// eslint-disable-next-line import/first
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
// eslint-disable-next-line import/first
import { Provider } from 'react-redux'
// eslint-disable-next-line import/first
import { store } from '@Pimcore/app/store'
// eslint-disable-next-line import/first
import { defaultTreeProps, ElementTree } from './element-tree'
// eslint-disable-next-line import/first
import { selectSelectedNodeIds, setNodeExpanded, type TreeNode } from './element-tree-slice'
// eslint-disable-next-line import/first
import { TreeIdProvider } from './provider/tree-id-provider/tree-id-provider'
// eslint-disable-next-line import/first
import { TreeFilterProvider } from './provider/tree-filter-provider/tree-filter-provider'
// eslint-disable-next-line import/first
import { NodeApiHookProvider } from './provider/node-api-hook-provider/node-api-hook-provider'
// eslint-disable-next-line import/first
import { TreeNode as TreeNodeComponent } from './node/tree-node'
// eslint-disable-next-line import/first
import { type DataTransformerReturnType, type DataTransformerSourceNode, type NodeApiHookReturnType } from './types/node-api-hook'
// eslint-disable-next-line import/first
import { type NodeState } from './hooks/use-element-tree-node'

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

const createNode = (id: string, parentId: string, hasChildren = false): TreeNode => ({
  id,
  parentId,
  elementType: 'data-object',
  icon: { type: 'name', value: 'folder' },
  label: `node-${id}`,
  hasChildren,
  permissions,
  locked: null,
  isLocked: false,
  internalKey: `${parentId}-${id}`
})

// hierarchy: root (1) -> 10, 11, 12, 13
const childrenByParent: Record<string, TreeNode[]> = {
  1: [createNode('10', '1'), createNode('11', '1'), createNode('12', '1'), createNode('13', '1')]
}

const useNodeApiHookMock = (): NodeApiHookReturnType => {
  const fetchRoot = async (id: number | string): Promise<DataTransformerReturnType | undefined> => {
    return { nodes: [createNode(String(id), '0', true)], total: 1 }
  }

  const fetchChildren = async (node: DataTransformerSourceNode, _nodeState: NodeState): Promise<DataTransformerReturnType | undefined> => {
    const nodes = childrenByParent[node.id] ?? []
    return { nodes, total: nodes.length }
  }

  return { fetchRoot, fetchChildren } as const
}

const TestTree = ({ treeId, onSelect }: { treeId: string, onSelect: jest.Mock }): React.JSX.Element => (
  <Provider store={ store }>
    <TreeIdProvider treeId={ treeId }>
      <TreeFilterProvider pageSize={ 10 }>
        <NodeApiHookProvider nodeApiHook={ useNodeApiHookMock }>
          <ElementTree
            nodeId={ 1 }
            onSelect={ onSelect }
            renderNode={ TreeNodeComponent }
            renderNodeContent={ defaultTreeProps.renderNodeContent }
            rootNode={ createNode('1', '0', true) }
            showRoot={ false }
          />
        </NodeApiHookProvider>
      </TreeFilterProvider>
    </TreeIdProvider>
  </Provider>
)

const nodeContentOf = (id: string): HTMLElement =>
  screen.getByTestId(`tree-node-data-object-${id}`).querySelector<HTMLElement>('.tree-node__content-inner')!

const selectedIds = (treeId: string): string[] => selectSelectedNodeIds(store.getState(), treeId)

const renderTree = async (treeId: string): Promise<jest.Mock> => {
  const onSelect = jest.fn()
  act(() => { store.dispatch(setNodeExpanded({ treeId, nodeId: '1', expanded: true })) })
  render(<TestTree
    onSelect={ onSelect }
    treeId={ treeId }
         />)
  await waitFor(() => { expect(screen.getByText('node-13')).toBeInTheDocument() })
  return onSelect
}

describe('TreeNode: multi-select', () => {
  it('selects a single node and opens it on a plain click', async () => {
    const treeId = 'multiselect-plain-click'
    const onSelect = await renderTree(treeId)

    fireEvent.click(nodeContentOf('10'))
    fireEvent.click(nodeContentOf('11'))

    expect(selectedIds(treeId)).toEqual(['11'])
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: '11' }))
  })

  it('toggles nodes with Ctrl/Cmd+click without opening them', async () => {
    const treeId = 'multiselect-toggle'
    const onSelect = await renderTree(treeId)

    fireEvent.click(nodeContentOf('10'))
    fireEvent.click(nodeContentOf('12'), { ctrlKey: true })
    fireEvent.click(nodeContentOf('13'), { metaKey: true })
    expect(selectedIds(treeId)).toEqual(['10', '12', '13'])

    fireEvent.click(nodeContentOf('12'), { ctrlKey: true })
    expect(selectedIds(treeId)).toEqual(['10', '13'])

    expect(onSelect).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByTestId('tree-node-data-object-13').querySelector('.tree-node__content--selected')).not.toBeNull()
      expect(screen.getByTestId('tree-node-data-object-12').querySelector('.tree-node__content--selected')).toBeNull()
    })
  })

  it('selects the visual range between the anchor and the clicked node with Shift+click', async () => {
    const treeId = 'multiselect-range'
    const onSelect = await renderTree(treeId)

    fireEvent.click(nodeContentOf('11'))
    fireEvent.click(nodeContentOf('13'), { shiftKey: true })
    expect(selectedIds(treeId)).toEqual(['11', '12', '13'])

    // the anchor stays where the plain click was, so the range can shrink or flip direction
    fireEvent.click(nodeContentOf('10'), { shiftKey: true })
    expect(selectedIds(treeId)).toEqual(['10', '11'])

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('falls back to a plain selection on Shift+click without an anchor', async () => {
    const treeId = 'multiselect-range-no-anchor'
    const onSelect = await renderTree(treeId)

    fireEvent.click(nodeContentOf('12'), { shiftKey: true })

    expect(selectedIds(treeId)).toEqual(['12'])
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('keeps the selection on right-click inside it and resets it on right-click outside', async () => {
    const treeId = 'multiselect-context-menu'
    const onSelect = await renderTree(treeId)

    fireEvent.click(nodeContentOf('10'))
    fireEvent.click(nodeContentOf('11'), { ctrlKey: true })

    fireEvent.contextMenu(nodeContentOf('11'))
    expect(selectedIds(treeId)).toEqual(['10', '11'])

    fireEvent.contextMenu(nodeContentOf('13'))
    expect(selectedIds(treeId)).toEqual(['13'])

    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
