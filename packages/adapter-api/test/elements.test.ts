import _ from 'lodash'
import {
  ElementsRegistry,
  ElemID,
  Field,
  InstanceElement,
  isEqualElements,
  isInstanceElement,
  isObjectType,
  isPrimitiveType,
  isType,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  Value,
  findElement,
  findElements,
  findObjectType,
  findInstances,
} from '../src/elements'

describe('Test elements.ts', () => {
  /**   ElemIDs   * */
  const primID = new ElemID('test', 'prim')
  const elemID = new ElemID('', 'string')

  /**   primitives   * */
  const primStr = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.STRING,
    annotationTypes: {},
    annotations: {},
  })

  const prim2Str = new PrimitiveType({
    elemID: new ElemID('test', 'prim2'),
    primitive: PrimitiveTypes.STRING,
    annotationTypes: {},
    annotations: {},
  })

  const primNum = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.NUMBER,
    annotationTypes: {},
    annotations: {},
  })

  /**   object types   * */
  const otID = new ElemID('test', 'obj')
  const ot = new ObjectType({
    elemID: otID,
    fields: {
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      num_field: new Field(otID, 'num_field', primNum),
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      str_field: new Field(otID, 'str_field', primStr),
    },
    annotationTypes: {},
    annotations: {},
  })

  let registry: ElementsRegistry

  beforeEach(async () => {
    registry = new ElementsRegistry()
  })

  it('should create a basic primitive type with all params passed to the constructor', () => {
    expect(primStr.elemID).toEqual(primID)
    expect(primStr.primitive).toBe(PrimitiveTypes.STRING)

    expect(primNum.elemID).toEqual(primID)
    expect(primNum.primitive).toBe(PrimitiveTypes.NUMBER)
  })

  it('should create a basic object type with all params passed to the constructor', () => {
    expect(ot.elemID).toEqual(otID)
    expect(ot.fields.num_field.type).toBeInstanceOf(PrimitiveType)
    expect(ot.fields.str_field.type).toBeInstanceOf(PrimitiveType)
  })

  it('Should test getValuesThatNotInPrevOrDifferent func', () => {
    const prevInstance = new InstanceElement('diff', new ObjectType({
      elemID: new ElemID('test', 'diff'),
      fields: {
      },
      annotationTypes: {},
      annotations: {},
    }),
    {
      userPermissions: [
        {
          enabled: false,
          name: 'ConvertLeads',
        },
      ],
      fieldPermissions: [
        {
          field: 'Lead.Fax',
          readable: false,
          editable: false,
        },
      ],
      description: 'old unit test instance profile',
    },)

    const newInstance = new InstanceElement('diff', new ObjectType({
      elemID: new ElemID('test', 'diff'),
      fields: {
      },
      annotationTypes: {},
      annotations: {},
    }),
    {
      userPermissions: [
        {
          enabled: false,
          name: 'ConvertLeads',
        },
      ],
      fieldPermissions: [
        {
          field: 'Lead.Fax',
          readable: false,
          editable: false,
        },
        {
          editable: false,
          field: 'Account.AccountNumber',
          readable: false,
        },
      ],
      applicationVisibilities: [
        {
          application: 'standard__ServiceConsole',
          default: false,
          visible: true,
        },
      ],
      description: 'new unit test instance profile',
    },)

    expect(newInstance.getValuesThatNotInPrevOrDifferent(prevInstance.value)).toMatchObject({
      fieldPermissions: [
        {
          field: 'Lead.Fax',
          readable: false,
          editable: false,
        },
        {
          editable: false,
          field: 'Account.AccountNumber',
          readable: false,
        },
      ],
      applicationVisibilities: [
        {
          application: 'standard__ServiceConsole',
          default: false,
          visible: true,
        },
      ],
      description: 'new unit test instance profile',
    },)
  })

  it('should allow to create types from the correct type them using registry.getElement method', () => {
    const st = registry.getElement(elemID, PrimitiveTypes.STRING)
    expect(st).toBeInstanceOf(PrimitiveType)

    const ot1 = registry.getElement(new ElemID('', 'object'))
    expect(ot1).toBeInstanceOf(ObjectType)
  })

  it('should reuse created types', () => {
    const st = registry.getElement(elemID, PrimitiveTypes.STRING)
    const st2 = registry.getElement(elemID, PrimitiveTypes.STRING)
    const st3 = registry.getElement(
      new ElemID('', 'string2'),
      PrimitiveTypes.STRING,
    )

    expect(st).toBe(st2)
    expect(st).not.toBe(st3)
  })

  it('should register types that were registered explicitly', () => {
    registry.registerElement(primStr)
    expect(primStr).toBe(registry.getElement(primID))
  })

  it('should not allow registration of same type id twice', () => {
    registry.registerElement(primStr)
    expect(() => { registry.registerElement(primStr) }).toThrow()
  })

  it('should allow clone without annotations.', () => {
    const saltoAddr = registry.getElement(new ElemID('salto', 'address'))
    saltoAddr.annotationTypes.label = registry.getElement(elemID)
    saltoAddr.fields.country = registry.getElement(elemID)
    saltoAddr.fields.city = registry.getElement(elemID)

    const saltoAddr2 = saltoAddr.clone()
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr).toEqual(saltoAddr2)

    const prim = registry.getElement(
      new ElemID('', 'prim'),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone()

    expect(prim).not.toBe(prim2)
    expect(prim).toEqual(prim2)
  })

  it('should allow clone with annotationTypes.', () => {
    const annotations: { [key: string]: Value } = {}
    annotations.label = 'label'

    // Object
    const stringType = registry.getElement(elemID)
    const saltoAddr = registry.getElement(new ElemID('salto', 'address'))
    saltoAddr.fields.country = new Field(saltoAddr.elemID, 'country', stringType)
    saltoAddr.fields.city = new Field(saltoAddr.elemID, 'city', stringType)

    const saltoAddr2 = saltoAddr.clone(annotations)
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr2).toMatchObject(saltoAddr)

    const prim = registry.getElement(
      new ElemID('', 'prim'),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone(annotations)

    expect(prim).not.toBe(prim2)
    expect(prim2).toMatchObject(prim)
  })

  it('should provide type guard for all types', () => {
    const pt = registry.getElement(elemID, PrimitiveTypes.STRING)
    const ot1 = registry.getElement(primID)

    expect(isObjectType(ot1)).toBeTruthy()
    expect(isPrimitiveType(pt)).toBeTruthy()
  })

  it('should allow to init a registry with types', () => {
    registry = new ElementsRegistry([prim2Str, primNum])
    expect(registry.hasElement(prim2Str.elemID)).toBeTruthy()
    expect(registry.hasElement(primNum.elemID)).toBeTruthy()

    const allTypes = registry.getAllElements()
    expect(allTypes).toContain(prim2Str)
    expect(allTypes).toContain(primNum)
  })

  it('should allow basic registry merge', () => {
    registry = new ElementsRegistry([primStr])
    const registry2 = new ElementsRegistry([prim2Str])
    const mergedReg = registry.merge(registry2)

    expect(mergedReg.hasElement(primStr.elemID)).toBeTruthy()
    expect(mergedReg.hasElement(prim2Str.elemID)).toBeTruthy()
  })

  it('should create a basic instance element', () => {
    const ot1 = registry.getElement(
      new ElemID('test', 'ot1')
    )
    const inst = new InstanceElement('test', ot1, { test: 'test' })
    expect(inst.elemID).toEqual(new ElemID('test', 'ot1', 'instance', 'test'))
    expect(inst.type).toBe(ot1)
    expect(inst.value.test).toBe('test')
  })

  it('should create a basic instance element from registry', () => {
    const ot1 = registry.getElement(elemID)
    const inst = registry.getElement(primID, ot1)

    expect(inst.type).toBe(ot1)
  })

  describe('isEqualElements and type guards', () => {
    const objT = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: {
        str: new Field(new ElemID('test', 'obj'), 'str_field', primStr),
      },
      annotationTypes: {
        anno: primStr,
      },
      annotations: {},
    })

    const strField = new Field(new ElemID('test', 'obj'), 'str_field', primStr)
    const inst = new InstanceElement('inst', objT, { str: 'test' })

    it('should identify equal primitive types', () => {
      expect(isEqualElements(primStr, _.cloneDeep(primStr))).toBeTruthy()
    })

    it('should identify equal object types', () => {
      expect(isEqualElements(ot, _.cloneDeep(ot))).toBeTruthy()
    })

    it('should identify different object types', () => {
      const otDiff = ot.clone()
      expect(isEqualElements(ot, otDiff)).toBeTruthy()

      otDiff.isSettings = true
      expect(isEqualElements(ot, otDiff)).toBeFalsy()
    })

    it('should identify equal fields', () => {
      expect(isEqualElements(strField, _.cloneDeep(strField))).toBeTruthy()
    })

    it('should identify equal instance elements', () => {
      expect(isEqualElements(inst, _.cloneDeep(inst))).toBeTruthy()
    })

    it('should identify one undefined as not equal', () => {
      expect(isEqualElements(inst, undefined)).toBeFalsy()
      expect(isEqualElements(undefined, inst)).toBeFalsy()
    })

    it('should identify different elements as false', () => {
      expect(isEqualElements(inst, ot)).toBeFalsy()
    })

    it('should identify primitive type', () => {
      expect(isPrimitiveType(primStr)).toBeTruthy()
      expect(isPrimitiveType(inst)).toBeFalsy()
    })

    it('should identify types', () => {
      expect(isType(inst)).toBeFalsy()
      expect(isType(primStr)).toBeTruthy()
    })

    it('should identify object types', () => {
      expect(isObjectType(inst)).toBeFalsy()
      expect(isObjectType(ot)).toBeTruthy()
    })

    it('should identify instance elements', () => {
      expect(isInstanceElement(inst)).toBeTruthy()
      expect(isInstanceElement(primStr)).toBeFalsy()
    })
  })

  describe('ElemID', () => {
    const typeId = new ElemID('adapter', 'example')
    const fieldId = typeId.createNestedID('field', 'test')
    const typeInstId = typeId.createNestedID('instance', 'test')
    const valueId = typeInstId.createNestedID('nested', 'value')
    const configTypeId = new ElemID('adapter')
    const configInstId = configTypeId.createNestedID('instance', ElemID.CONFIG_NAME)

    describe('getFullName', () => {
      it('should contain adapter and type name for type ID', () => {
        expect(typeId.getFullName()).toEqual('adapter.example')
      })
      it('should contain type id and field name for field ID', () => {
        expect(fieldId.getFullName()).toEqual(`${typeId.getFullName()}.field.test`)
      })
      it('should contain type id and instance name for instance ID', () => {
        expect(typeInstId.getFullName()).toEqual(`${typeId.getFullName()}.instance.test`)
      })
      it('should contain inst id and value path for value in instance', () => {
        expect(valueId.getFullName()).toEqual(`${typeInstId.getFullName()}.nested.value`)
      })
      it('should contain only adapter for config type', () => {
        expect(configTypeId.getFullName()).toEqual(configTypeId.adapter)
      })
      it('should contain full type and the word instance for config instance', () => {
        expect(configInstId.getFullName()).toEqual(
          `${configTypeId.adapter}.${configTypeId.typeName}.instance`,
        )
      })
    })

    describe('fromFullName', () => {
      it('should create elem ID from its full name', () => {
        [typeId, fieldId, typeInstId, valueId, configTypeId, configInstId]
          .forEach(id => expect(ElemID.fromFullName(id.getFullName())).toEqual(id))
      })
      it('should fail on invalid id type', () => {
        expect(() => ElemID.fromFullName('adapter.type.bla.foo')).toThrow()
      })
    })

    describe('nestingLevel', () => {
      describe('for config, types and instances', () => {
        it('should be zero', () => {
          expect(typeId.nestingLevel).toEqual(0)
          expect(typeInstId.nestingLevel).toEqual(0)
          expect(configTypeId.nestingLevel).toEqual(0)
          expect(configInstId.nestingLevel).toEqual(0)
        })
      })
      describe('for nested ids', () => {
        it('should match the number of name parts', () => {
          expect(fieldId.nestingLevel).toEqual(1)
          expect(fieldId.createNestedID('a', 'b').nestingLevel).toEqual(3)
        })
        it('should match path length in instance values', () => {
          expect(valueId.nestingLevel).toEqual(2)
        })
      })
    })

    describe('isConfig', () => {
      it('should return true for config type ID', () => {
        expect(configTypeId.isConfig()).toBeTruthy()
      })

      it('should return true for config instance ID', () => {
        expect(configInstId.isConfig()).toBeTruthy()
      })

      it('should return false for other IDs', () => {
        expect(typeId.isConfig()).toBeFalsy()
      })
    })

    describe('createNestedID', () => {
      describe('from type ID', () => {
        it('should create nested ID with the correct id type', () => {
          const fieldID = typeId.createNestedID('field', 'name')
          expect(fieldID).toEqual(new ElemID('adapter', 'example', 'field', 'name'))
          expect(fieldID.idType).toEqual('field')
        })
        it('should fail if given an invalid id type', () => {
          expect(() => typeId.createNestedID('bla')).toThrow()
        })
      })
      describe('from field ID', () => {
        let nestedId: ElemID
        beforeEach(() => {
          nestedId = fieldId.createNestedID('nested')
        })
        it('should keep the original id type', () => {
          expect(nestedId.idType).toEqual(fieldId.idType)
        })
        it('should have the new name', () => {
          expect(nestedId.name).toEqual('nested')
        })
      })
    })

    describe('createParentID', () => {
      describe('from type ID', () => {
        it('should return the adapter ID', () => {
          expect(typeId.createParentID()).toEqual(new ElemID(typeId.adapter))
        })
      })
      describe('from instance ID', () => {
        it('should return the adapter ID', () => {
          expect(typeInstId.createParentID()).toEqual(new ElemID(typeInstId.adapter))
        })
      })
      describe('from config instance ID', () => {
        it('should return the adapter ID', () => {
          expect(configInstId.createParentID()).toEqual(new ElemID(typeInstId.adapter))
        })
      })
      describe('from field ID', () => {
        it('should return the type ID', () => {
          expect(fieldId.createParentID()).toEqual(new ElemID(fieldId.adapter, fieldId.typeName))
        })
      })
      describe('from nested ID', () => {
        it('should return one nesting level less deep', () => {
          [fieldId, typeInstId, configInstId].forEach(
            parent => expect(parent.createNestedID('test').createParentID()).toEqual(parent)
          )
        })
      })
    })

    describe('createTopLevelParentID', () => {
      describe('from top level element', () => {
        it('should return the same ID and empty path', () => {
          [typeId, typeInstId, configTypeId, configInstId].forEach(id => {
            const { parent, path } = id.createTopLevelParentID()
            expect(parent).toEqual(id)
            expect(path).toHaveLength(0)
          })
        })
      })
      describe('from field id', () => {
        let parent: ElemID
        let path: ReadonlyArray<string>
        beforeAll(() => {
          ({ parent, path } = fieldId.createTopLevelParentID())
        })

        it('should return the type', () => {
          expect(parent).toEqual(new ElemID(fieldId.adapter, fieldId.typeName))
        })
        it('should return the field name as the path', () => {
          expect(path).toEqual([fieldId.name])
        })
      })
      describe('from value id', () => {
        let parent: ElemID
        let path: ReadonlyArray<string>
        beforeAll(() => {
          ({ parent, path } = valueId.createTopLevelParentID())
        })

        it('should return the instance', () => {
          expect(parent).toEqual(typeInstId)
        })
        it('should return the nesting path in the instance', () => {
          expect(path).toEqual(['nested', 'value'])
        })
      })
    })
  })

  describe('findElement functions', () => {
    const instances = [
      new InstanceElement('1', ot, {}),
      new InstanceElement('2', ot, {}),
    ]
    const elements = [primStr, primStr, ot, ...instances]
    describe('findElements', () => {
      it('should find all elements with the requested id', () => {
        expect([...findElements(elements, primID)]).toEqual([primStr, primStr])
      })
    })
    describe('findElement', () => {
      it('should find any matching element', () => {
        expect(findElement(elements, ot.elemID)).toBe(ot)
        expect(findElement(elements, primID)).toBe(primStr)
      })
      it('should return undefined if there is no matching element', () => {
        expect(findElement([], primID)).toBeUndefined()
      })
    })
    describe('findObjectType', () => {
      it('should find object type by ID', () => {
        expect(findObjectType(elements, ot.elemID)).toBe(ot)
      })
      it('should not find non-object types', () => {
        expect(findObjectType(elements, primID)).toBeUndefined()
      })
    })
    describe('findInstances', () => {
      it('should find all instances of a given type', () => {
        expect([...findInstances(elements, ot.elemID)]).toEqual(instances)
      })
    })
  })
})
