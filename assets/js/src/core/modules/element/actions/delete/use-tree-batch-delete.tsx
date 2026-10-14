/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { useAppDispatch } from '@Pimcore/app/store'
import { eventBus, eventTypes } from '@Pimcore/lib/event-bus'
import { Accordion } from '@Pimcore/components/accordion/accordion'
import { type ItemType } from '@Pimcore/components/dropdown/dropdown'
import { clearSelectedNodeIds, markNodeDeleting, refreshSourceNode, type TreeNode } from '@Pimcore/components/element-tree/element-tree-slice'
import { useTreeId } from '@Pimcore/components/element-tree/provider/tree-id-provider/use-tree-id'
import { useTreePermission } from '@Pimcore/components/element-tree/provider/tree-permission-provider/use-tree-permission'
import { Icon } from '@Pimcore/components/icon/icon'
import { useFormModal } from '@Pimcore/components/modal/form-modal/hooks/use-form-modal'
import trackError, { GeneralError } from '@Pimcore/modules/app/error-handler'
import { api as elementApi } from '@Pimcore/modules/element/element-api-slice.gen'
import { checkElementPermission } from '@Pimcore/modules/element/permissions/permission-helper'
import { useExecutionEngine } from '@Pimcore/modules/execution-engine/hooks/use-execution-engine'
import { type AbstractBatchDeleteJob, type AbstractBatchDeleteJobOptions } from '@Pimcore/modules/execution-engine/jobs/batch-delete/abstract-batch-delete-job'
import { AssetBatchDeleteJob } from '@Pimcore/modules/execution-engine/jobs/batch-delete/asset-batch-delete-job'
import { DataObjectBatchDeleteJob } from '@Pimcore/modules/execution-engine/jobs/batch-delete/data-object-batch-delete-job'
import { DeleteJob } from '@Pimcore/modules/execution-engine/jobs/delete/element-delete-job'
import { useRecycleBin } from '@Pimcore/modules/recycle-bin/hooks/use-recycle-bin'
import { useWidgetManager } from '@Pimcore/modules/widget-manager/hooks/use-widget-manager'
import { getWidgetId } from '@Pimcore/modules/widget-manager/utils/tools'
import { type ElementType } from '@Pimcore/types/enums/element/element-type'
import { isNil, uniq } from 'lodash'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { TreePermission } from '../../../perspectives/enums/tree-permission'
import { useStyles } from './use-delete.styles'

export interface UseTreeBatchDeleteHookReturn {
  batchDeleteTreeContextMenuItem: (nodes: TreeNode[], onFinish?: () => void) => ItemType | null
}

type BatchDeleteJobConstructor = new (options: AbstractBatchDeleteJobOptions) => AbstractBatchDeleteJob

// Documents have no batch delete endpoint yet and fall back to one delete job per node.
const batchDeleteJobs: Partial<Record<ElementType, BatchDeleteJobConstructor>> = {
  asset: AssetBatchDeleteJob,
  'data-object': DataObjectBatchDeleteJob
}

const PATH_LIST_COLLAPSE_THRESHOLD = 5

/**
 * Deletes every node of a tree multi-selection, matching the classic admin's "Delete" entry for
 * several selected nodes: one confirmation, one job where the backend supports it, one refresh per
 * affected parent once everything is done.
 */
export const useTreeBatchDelete = (elementType: ElementType): UseTreeBatchDeleteHookReturn => {
  const { t } = useTranslation()
  const modal = useFormModal()
  const dispatch = useAppDispatch()
  const executionEngine = useExecutionEngine()
  const { refreshRecycleBin } = useRecycleBin()
  const { isMainWidgetOpen, closeWidget } = useWidgetManager()
  const { isTreeActionAllowed } = useTreePermission()
  const { treeId } = useTreeId(true)
  const { styles } = useStyles()

  const parentIdsOf = (nodes: TreeNode[]): string[] => {
    return uniq(nodes.map((node) => node.parentId).filter((parentId): parentId is string => !isNil(parentId)))
  }

  const setDeleting = (nodes: TreeNode[], isDeleting: boolean): void => {
    nodes.forEach((node) => {
      dispatch(markNodeDeleting({ nodeId: node.id, elementType, isDeleting }))
    })
  }

  const finishDeletion = (nodes: TreeNode[], onFinish?: () => void): void => {
    parentIdsOf(nodes).forEach((parentId) => {
      dispatch(refreshSourceNode({ nodeId: parentId, elementType }))
    })

    nodes.forEach((node) => {
      const id = parseInt(node.id)

      eventBus.publish({
        identifier: { type: eventTypes['element:item:deleted'] },
        payload: { id, elementType }
      })

      const widgetId = getWidgetId(elementType, id)
      if (isMainWidgetOpen(widgetId)) {
        closeWidget(widgetId)
      }
    })

    if (!isNil(treeId)) {
      dispatch(clearSelectedNodeIds({ treeId }))
    }

    refreshRecycleBin()
    onFinish?.()
  }

  const runBatchDeleteJob = async (JobClass: BatchDeleteJobConstructor, nodes: TreeNode[], onFinish?: () => void): Promise<void> => {
    const job = new JobClass({
      itemIds: nodes.map((node) => parseInt(node.id)),
      onFinish: async () => { finishDeletion(nodes, onFinish) }
    })

    await executionEngine.runJob(job)
  }

  const runSingleDeleteJobs = async (nodes: TreeNode[], onFinish?: () => void): Promise<void> => {
    for (const node of nodes) {
      await executionEngine.runJob(new DeleteJob({
        elementId: parseInt(node.id),
        elementType,
        treeId,
        nodeId: node.id,
        parentFolderId: isNil(node.parentId) ? undefined : parseInt(node.parentId)
      }))
    }

    finishDeletion(nodes, onFinish)
  }

  const deleteNodes = async (nodes: TreeNode[], onFinish?: () => void): Promise<void> => {
    setDeleting(nodes, true)

    try {
      const JobClass = batchDeleteJobs[elementType]

      if (isNil(JobClass)) {
        await runSingleDeleteJobs(nodes, onFinish)
        return
      }

      await runBatchDeleteJob(JobClass, nodes, onFinish)
    } catch (error: any) {
      setDeleting(nodes, false)
      trackError(new GeneralError(error.message as string))
    }
  }

  // The recycle bin only takes elements up to a descendant threshold; ask the backend for every
  // node that can have children so the confirmation can say whether the deletion is reversible.
  const canUseRecycleBin = async (nodes: TreeNode[]): Promise<boolean> => {
    const containerNodes = nodes.filter((node) => node.type === 'folder' || node.hasChildren === true)

    const deleteInfos = await Promise.all(containerNodes.map(async (node) => {
      const { data } = await dispatch(elementApi.endpoints.elementGetDeleteInfo.initiate({ elementType, id: parseInt(node.id) }))
      return data
    }))

    return deleteInfos.every((deleteInfo) => deleteInfo?.canUseRecycleBin ?? true)
  }

  const confirmDeletion = async (nodes: TreeNode[], onFinish?: () => void): Promise<void> => {
    const count = nodes.length
    const isReversible = await canUseRecycleBin(nodes)
    const pathList = (
      <ul>
        {nodes.map((node) => <li key={ node.id }>{node.fullPath ?? node.label}</li>)}
      </ul>
    )

    modal.confirm({
      title: t('element.delete.batch.title'),
      width: 530,
      content: <>
        <p>{t('element.delete.batch.question', { count })}</p>
        {count > PATH_LIST_COLLAPSE_THRESHOLD
          ? <Accordion items={ [{ key: 'paths', title: <span>{t('element.delete.batch.show-paths')}</span>, children: pathList }] } />
          : pathList}
        <p>
          <span className={ styles.warningText }>
            {isReversible ? t('element.delete.batch.dependencies-warning') : t('element.delete.batch.note')}
          </span>
        </p>
      </>,
      cancelText: t('cancel'),
      okText: t('element.delete.batch.ok'),
      onOk: async () => { await deleteNodes(nodes, onFinish) }
    })
  }

  const batchDeleteTreeContextMenuItem = (nodes: TreeNode[], onFinish?: () => void): ItemType | null => {
    if (nodes.length < 2) {
      return null
    }

    const isAnyNodeProtected = nodes.some((node) => !checkElementPermission(node.permissions, 'delete') || node.isLocked)

    return {
      label: `${t('element.delete')} (${nodes.length})`,
      key: 'batch-delete',
      icon: <Icon value={ 'trash' } />,
      hidden: !isTreeActionAllowed(TreePermission.Delete) || isAnyNodeProtected,
      onClick: () => { void confirmDeletion(nodes, onFinish) }
    }
  }

  return { batchDeleteTreeContextMenuItem }
}
