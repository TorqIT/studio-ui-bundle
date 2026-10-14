/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { isNil, isUndefined } from 'lodash'
import { t } from 'i18next'
import { store } from '@Pimcore/app/store'
import trackError, { ApiError, GeneralError } from '@Pimcore/modules/app/error-handler'
import { api as assetApi } from '@Pimcore/modules/asset/asset-api-slice-enhanced'
import { api as dataObjectApi } from '@Pimcore/modules/data-object/data-object-api-slice-enhanced'
import { type JobInterface, type JobRunOptions } from '../job-interface'
import { MessageBusJobHandler, type JobCompletionData } from '../../message-handlers/message-bus-job/message-bus-job-handler'
import { BatchedStepProgressCalculator } from '../../message-handlers/message-bus-job/progress-calculator/batched-step-progress-calculator'
import { type BatchMoveElement, buildBatchMovePayload } from './batch-move-payload'

export interface ElementBatchMoveJobOptions {
  elementType: 'asset' | 'data-object'
  elements: BatchMoveElement[]
  targetId: number
  onFinish?: () => Promise<void>
  onFailure?: () => Promise<void>
}

/**
 * Moves several elements in one request. The patch endpoint turns a multi-element payload into
 * an execution-engine job (`studio_ee_job_patch_elements`) and answers 201 with a jobRunId, so
 * the tree must wait for the job to finish before refreshing — refreshing on the HTTP response
 * only shows whichever elements happened to be processed first.
 */
export class ElementBatchMoveJob implements JobInterface {
  private readonly elementType: ElementBatchMoveJobOptions['elementType']
  private readonly elements: BatchMoveElement[]
  private readonly targetId: number
  private readonly onFinish?: () => Promise<void>
  private readonly onFailure?: () => Promise<void>

  constructor (options: ElementBatchMoveJobOptions) {
    this.elementType = options.elementType
    this.elements = options.elements
    this.targetId = options.targetId
    this.onFinish = options.onFinish
    this.onFailure = options.onFailure
  }

  async run (options: JobRunOptions): Promise<void> {
    const { messageBus } = options

    try {
      const jobRunId = await this.executeMoveRequest()

      if (isNil(jobRunId)) {
        await this.handleJobFailure(new Error('No jobRunId returned from move request'))
        return
      }

      const handler = new MessageBusJobHandler({
        jobRunId,
        title: t('batch-move.job-title'),
        progressCalculator: new BatchedStepProgressCalculator(),
        onJobCompletion: async (data: JobCompletionData) => {
          if (data.isFinished) {
            await this.onFinish?.()
          } else {
            await this.handleJobFailure(new Error(`Job failed with status: ${data.status}`))
          }
        },
        onRetry: async () => {
          await this.run(options)
        }
      })

      messageBus.registerHandler(handler)
    } catch (error: any) {
      await this.handleJobFailure(error)
    }
  }

  private async executeMoveRequest (): Promise<number | null> {
    const body = {
      data: buildBatchMovePayload(this.elements, this.targetId)
    }

    const response = this.elementType === 'asset'
      ? await store.dispatch(assetApi.endpoints.assetPatchById.initiate({ body }))
      : await store.dispatch(dataObjectApi.endpoints.dataObjectPatchById.initiate({ body }))

    if (!isUndefined(response.error)) {
      trackError(new ApiError(response.error))
      return null
    }

    return response.data?.jobRunId ?? null
  }

  private async handleJobFailure (error: any): Promise<void> {
    console.error('Batch move job failed:', error)
    await this.onFailure?.()
    trackError(new GeneralError(error.message as string))
  }
}
