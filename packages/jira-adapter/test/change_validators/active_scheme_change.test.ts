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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression, ChangeValidator } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockClient } from '../utils'
import { activeSchemeChangeValidator } from '../../src/change_validators/active_scheme_change'
import { JIRA } from '../../src/constants'

describe('active scheme change', () => {
  const workflowSchemeReference1 = new ReferenceExpression(new ElemID(JIRA, 'WorkflowScheme', 'instance', 'workflow1'))
  const workflowSchemeReference2 = new ReferenceExpression(new ElemID(JIRA, 'WorkflowScheme', 'instance', 'workflow2'))
  const prioritySchemeReference1 = new ReferenceExpression(new ElemID(JIRA, 'PriorityScheme', 'instance', 'priority1'))
  const prioritySchemeReference2 = new ReferenceExpression(new ElemID(JIRA, 'PriorityScheme', 'instance', 'priority2'))
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let projectType: ObjectType
  let projectInstance: InstanceElement
  let modifiedInstance: InstanceElement
  let validator: ChangeValidator
  let numberOfIssues: number

  beforeEach(() => {
    jest.clearAllMocks()
    const { client, connection } = mockClient()
    mockConnection = connection
    numberOfIssues = 100
    projectType = new ObjectType({ elemID: new ElemID(JIRA, 'Project') })
    projectInstance = new InstanceElement(
      'project',
      projectType,
      {
        name: 'instance',
        workflowScheme: workflowSchemeReference1,
      }
    )
    modifiedInstance = new InstanceElement(
      'project',
      projectType,
      {
        name: 'instance',
        workflowScheme: workflowSchemeReference2,
      }
    )
    mockConnection.get.mockImplementation(async url => {
      if (url === '/rest/api/3/search') {
        return {
          status: 200,
          data: {
            total: numberOfIssues,
          },
        }
      }
      throw new Error(`Unexpected url ${url}`)
    })
    validator = activeSchemeChangeValidator(client)
  })
  it('should not return error for addition/removal changes', async () => {
    const deletionErrors = await validator([toChange({ before: projectInstance })])
    expect(deletionErrors).toHaveLength(0)
    const additionErrors = await validator([toChange({ after: projectInstance })])
    expect(additionErrors).toHaveLength(0)
  })
  it('should not return error if workflow scheme have not changed', async () => {
    const errors = await validator([toChange({ before: projectInstance, after: projectInstance })])
    expect(errors).toHaveLength(0)
  })
  it('should not return error for projects without issues', async () => {
    numberOfIssues = 0
    const errors = await validator([toChange({ before: projectInstance, after: modifiedInstance })])
    expect(errors).toHaveLength(0)
  })
  it('should return an error when there are issues', async () => {
    const errors = await validator([toChange({ before: projectInstance, after: modifiedInstance })])
    expect(errors).toHaveLength(1)
  })
  it('should return an error for both fields if both changed', async () => {
    projectInstance.value.priorityScheme = prioritySchemeReference1
    modifiedInstance.value.priorityScheme = prioritySchemeReference2
    const errors = await validator([toChange({ before: projectInstance, after: modifiedInstance })])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toEqual('Can’t replace non-empty project priorityScheme, workflowScheme')
  })
})
