/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ChangeValidator, isReferenceExpression, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { PROJECT_CONTEXTS_FIELD } from '../../filters/fields/contexts_projects_filter'
import { PROJECT_TYPE } from '../../constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { getUnreferencedContextErrors } from './unreferenced_context'
import { getGlobalContextsUsedInProjectErrors } from './referenced_global_context'

const { awu } = collections.asynciterable
const log = logger(module)

/**
 * Verify that the field context is referenced by a project.
 */
export const fieldContextValidator: ChangeValidator = async (_changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }

  const ids = await awu(await elementSource.list()).toArray()

  const projects = await awu(ids)
    .filter(id => id.typeName === PROJECT_TYPE)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()

  const contexts = await awu(ids)
    .filter(id => id.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()

  const fields = await awu(ids)
    .filter(id => id.typeName === 'Field')
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()
  const fieldsToContexts = Object.fromEntries(fields
    .filter(field => field.value.contexts !== undefined)
    .map(field => [
      field.elemID.getFullName(),
      field.value.contexts.filter((ref: ReferenceExpression) => {
        if (!isReferenceExpression(ref)) {
          log.warn(`Found a non reference expression in field ${field.elemID.getFullName()}`)
          return false
        }
        return true
      }).map((context: ReferenceExpression) => context.elemID),
    ]))
  const projectNamesToContexts: Record<string, string[]> = Object.fromEntries(projects
    .filter(project => project.value[PROJECT_CONTEXTS_FIELD] !== undefined)
    .map(project => [
      project.elemID.name,
      project.value[PROJECT_CONTEXTS_FIELD].filter((ref: ReferenceExpression) => {
        if (!isReferenceExpression(ref)) {
          log.warn(`Found a non reference expression in project ${project.elemID.getFullName()}`)
          return false
        }
        return true
      }).map((context: ReferenceExpression) => context.elemID.getFullName()),
    ]))

  return [
    ...getUnreferencedContextErrors(contexts, fieldsToContexts, Object.values(projectNamesToContexts).flat()),
    ...getGlobalContextsUsedInProjectErrors(contexts, projectNamesToContexts),
  ]
}
