/**
 * This source file is available under the terms of the
 * Pimcore Open Core License (POCL)
 * Full copyright and license information is available in
 * LICENSE.md which is distributed with this source code.
 *
 *  @copyright  Copyright (c) Pimcore GmbH (https://www.pimcore.com)
 *  @license    Pimcore Open Core License (POCL)
 */

import { serviceIds } from '@Pimcore/app/config/services/service-ids'
import { container } from '@Pimcore/app/depency-injection'
import { type ItemType } from '@Pimcore/components/dropdown/dropdown'
import { type ContextMenuRegistryInterface } from './context-menu-registry'

export function useContextMenuSlot (
  slotName: string,
  context: any
): ItemType[] {
  const contextMenuRegistry = container.get<ContextMenuRegistryInterface>(serviceIds['App/ContextMenuRegistry/ContextMenuRegistry'])
  const isMultiSelection = Array.isArray(context?.selectedNodes) && context.selectedNodes.length > 1
  const providers = contextMenuRegistry.getSlotProviders(slotName)
    .filter((provider) => !isMultiSelection || provider.supportsMultiSelection === true)

  return providers.map((provider) => {
    // Generate the menu item directly
    return provider.useMenuItem(context)
  }).filter((item): item is ItemType => item !== null)
}
