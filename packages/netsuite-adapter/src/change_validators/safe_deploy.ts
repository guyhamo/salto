/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { isInstanceChange, InstanceElement, Element,
  ProgressReporter, ChangeError, Change, isInstanceElement, isEqualElements,
  getChangeElement, ModificationChange,
  isRemovalChange, isModificationChange, isAdditionChange, AdditionChange, RemovalChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { buildNetsuiteQuery, convertToQueryParams, NetsuiteQuery, NetsuiteQueryParameters } from '../query'
import { isCustomType, isFileCabinetInstance } from '../types'
import { PATH, SCRIPT_ID } from '../constants'

export type FetchByQueryReturnType = {
  failedToFetchAllAtOnce: boolean
  failedFilePaths: string[]
  failedTypeToInstances: Record<string, string[]>
  elements: Element[]
}

export type FetchByQueryFunc = (
  fetchQuery: NetsuiteQuery,
  progressReporter: ProgressReporter,
  useChangesDetection: boolean
) => Promise<FetchByQueryReturnType>

export type QueryChangeValidator = (
  changes: ReadonlyArray<Change>, fetchByQuery: FetchByQueryFunc)
 => Promise<ReadonlyArray<ChangeError>>

const { awu } = collections.asynciterable

const getScriptIdsByType = (
  instancesByType: Record<string, InstanceElement[]>
): Record<string, string[]> => (
  Object.fromEntries(Object.entries(instancesByType)
    .map(([type, instances]) => [type, instances
      .filter(instance => instance.value[SCRIPT_ID] !== undefined)
      .map(instance => instance.value[SCRIPT_ID])]))
)

const getMatchingServiceInstances = async (
  baseInstances: InstanceElement[],
  fetchByQuery: FetchByQueryFunc
): Promise<Record<string, InstanceElement>> => {
  // TODO: we currently support only SDF types (i.e custom types and file cabinet),
  // and not yet suiteapp types (SALTO-1531)

  const filePaths = baseInstances
    .filter(isFileCabinetInstance)
    .filter(inst => inst.value[PATH] !== undefined)
    .map(inst => inst.value[PATH])

  const customInstances = baseInstances.filter(inst => isCustomType(inst.refType.elemID))
  const instancesByType = _.groupBy(customInstances, instance => instance.elemID.typeName)
  const fetchTarget: NetsuiteQueryParameters = {
    types: getScriptIdsByType(instancesByType),
    filePaths,
  }

  const fetchQuery = buildNetsuiteQuery(convertToQueryParams(fetchTarget))

  const { elements } = await fetchByQuery(fetchQuery, { reportProgress: () => null }, false)
  return _.keyBy(elements.filter(isInstanceElement), element => element.elemID.getFullName())
}

const toChangeWarning = (change: Change<InstanceElement>): ChangeError => (
  {
    elemID: getChangeElement(change).elemID,
    severity: 'Warning',
    message: 'Continuing the deploy proccess will override changes made in the service to this element.',
    detailedMessage: `The element ${getChangeElement(change).elemID.name}, which you are attempting to ${change.action}, has recently changed in the service.`,
  }
)

const hasChangedInService = (
  change: RemovalChange<InstanceElement> | ModificationChange<InstanceElement>,
  serviceInstance: InstanceElement
): boolean => (
  !isEqualElements(change.data.before, serviceInstance)
)

const isChangeTheSameInService = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  serviceInstance: InstanceElement
): boolean => (
  isEqualElements(change.data.after, serviceInstance)
)

const isModificationOverridingChange = (
  change: Change<InstanceElement>,
  matchingServiceInstance: InstanceElement,
): boolean => (
  isModificationChange(change)
  && hasChangedInService(change, matchingServiceInstance)
  && !isChangeTheSameInService(change, matchingServiceInstance)
)

const isRemovalOverridingChange = (
  change: Change<InstanceElement>,
  matchingServiceInstance: InstanceElement,
): boolean => (
  isRemovalChange(change)
  && hasChangedInService(change, matchingServiceInstance)
)

const isAdditionOverridingChange = (
  change: Change<InstanceElement>,
  matchingServiceInstance: InstanceElement,
): boolean => (
  isAdditionChange(change)
  && matchingServiceInstance !== undefined
  && !isChangeTheSameInService(change, matchingServiceInstance)
)


const changeValidator: QueryChangeValidator = async (
  changes: ReadonlyArray<Change>,
  fetchByQuery: FetchByQueryFunc
) => {
  const instanceChanges = await awu(changes)
    .filter(isInstanceChange)
    .toArray()

  const serviceInstances = await getMatchingServiceInstances(
    instanceChanges.map(getChangeElement),
    fetchByQuery
  )

  const isOverridingChange = (
    change: Change<InstanceElement>
  ): boolean => {
    const matchingServiceInstance = serviceInstances[getChangeElement(change).elemID.getFullName()]
    return (isModificationOverridingChange(change, matchingServiceInstance)
    || isRemovalOverridingChange(change, matchingServiceInstance)
    || isAdditionOverridingChange(change, matchingServiceInstance)
    )
  }

  return instanceChanges
    .filter(isOverridingChange)
    .map(toChangeWarning)
}

export default changeValidator
