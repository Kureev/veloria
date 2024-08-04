import fs from 'fs'
import path from 'path'
import { TypeGenerator } from '../types/TypeGenerator'
import { findProjectRoot } from '../utils'
import { HookObject } from './HookObject'
import { DatabaseSchema } from '../migrations/common/DatabaseSchema'

const root = findProjectRoot(__dirname)

/**
 * Class to generate React hooks for the schema
 */
export class HooksGenerator {
  constructor(private schema: DatabaseSchema) {}

  getHookName(name: string) {
    return `use${name}`
  }

  getFieldMapping(name: string) {
    const table = this.schema.getTables()[name]
    return (
      '{\n' +
      Object.entries(table.columns)
        .map(([key, value]) => `  ${key}: '${value.get('map') ?? key}'`)
        .join(',\n') +
      '\n}'
    )
  }

  generate() {
    const typeGenerator = new TypeGenerator(this.schema)
    const hooks = Object.entries(this.schema.getTables()).map(([name]) => {
      const entityName = typeGenerator.getEntityName(name)
      const content = fs.readFileSync(path.resolve(root, 'templates', 'hook.ts')).toString('utf8')
      return new HookObject(
        this.getHookName(name),
        content
          .replace(/\$MODEL_NAME/g, entityName)
          .replace(/\$MAPPED_MODEL_NAME/g, typeGenerator.getMappedEntityName(name))
          .replace(/\$FIELD_MAPPING/g, this.getFieldMapping(name))
      )
    })

    return hooks
  }
}
