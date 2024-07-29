import fs from 'fs'
import path from 'path'
import { DatabaseSchema } from '../migrations/types'
import { TypeGenerator } from '../types/TypeGenerator'
import { findProjectRoot } from '../utils'
import { HookObject } from './HookObject'

const root = findProjectRoot(__dirname)

/**
 * Class to generate React hooks for the schema
 */
export class HooksGenerator {
  private schema: DatabaseSchema

  constructor(schema: DatabaseSchema) {
    const filtered = Object.entries(schema.tables).filter(([, table]) => !table.ignore)
    this.schema = { tables: Object.fromEntries(filtered) }
  }

  getHookName(name: string) {
    return `use${name}`
  }

  generate() {
    const typeGenerator = new TypeGenerator(this.schema)
    const hooks = Object.entries(this.schema.tables).map(([name]) => {
      const entityName = typeGenerator.getEntityName(name)
      const content = fs.readFileSync(path.resolve(root, 'templates', 'hook.ts')).toString('utf8')
      return new HookObject(this.getHookName(name), content.replace(/\$MODEL_NAME/g, entityName))
    })

    return hooks
  }
}
