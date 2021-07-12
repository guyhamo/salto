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

import { collections } from '@salto-io/lowerdash'
import { getChangeElement, InstanceElement, isInstanceChange, isInstanceElement, isObjectType, StaticFile } from '@salto-io/adapter-api'
import _ from 'lodash'
import { NETSUITE, SAVED_SEARCH } from '../constants'
import { FilterCreator } from '../filter'
import { savedsearch, savedsearchInnerTypes } from '../types/custom_types/parsedSavedSearch'
import { savedsearch as oldSavedSearch } from '../types/custom_types/savedsearch'
import { parseDefinition } from '../saved_search_parser'

const { awu } = collections.asynciterable

const changeDefinitiontoStaticFile = (instance: InstanceElement):void => {
  instance.value.definition = new StaticFile({
    filepath: `${NETSUITE}/${instance.elemID.typeName}/definition_${instance.elemID.name}`,
    content: instance.value.definition,
  })
}

const revertDefinitionToString = (instance: InstanceElement):void => {
  instance.value.definition = instance.value.definition.content
}

const assignValuesToInstance = async (instance:InstanceElement,
  oldInstance: InstanceElement):Promise<void> => {
  Object.assign(instance.value, await parseDefinition(instance.value.definition))
  if (oldInstance !== undefined && oldInstance.value.definition.content !== undefined) {
    if (await _.isEqual(parseDefinition(oldInstance.value.definition.content),
      parseDefinition(instance.value.definition))) {
      instance.value.definition = oldInstance.value.definition.content
    }
  }
  changeDefinitiontoStaticFile(instance)
}

const removeValuesFromInstace = (instance:InstanceElement):void => {
  Object.keys(instance.value)
    .filter(key => !Object.keys(oldSavedSearch.fields).includes(key))
    .forEach(key => delete instance.value[key])
  revertDefinitionToString(instance)
}

const filterCreator: FilterCreator = ({ elementsSource }) => ({
  onFetch: async elements => {
    _.remove(elements, e => isObjectType(e) && e.elemID.name === SAVED_SEARCH)
    elements.push(savedsearch)
    elements.push(...savedsearchInnerTypes)
    await Promise.all(
      elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === SAVED_SEARCH)
        .map(async (instance: InstanceElement) => {
          await assignValuesToInstance(instance, await elementsSource.get(instance.elemID))
        })
    )
  },
  preDeploy: async changes => {
    awu(changes)
      .filter(isInstanceChange)
      .map(getChangeElement)
      .filter(instance => instance.elemID.typeName === SAVED_SEARCH)
      .forEach(instance => removeValuesFromInstace(instance))
  },
})

export default filterCreator
