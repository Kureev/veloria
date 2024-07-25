import { ColumnDefinition, DatabaseSchema, Field } from '../migrations/types'
import { TypeGenerator } from '../types/TypeGenerator'
import { HookObject } from './HookObject'

enum Operation {
  CREATE = 'Create',
  READ = 'Read',
  UPDATE = 'Update',
  DELETE = 'Delete',
}

/**
 * Class to generate React hooks for the schema
 */
export class HooksGenerator {
  private schema: DatabaseSchema

  constructor(schema: DatabaseSchema) {
    const filtered = Object.entries(schema.tables).filter(([, table]) => !table.ignore)
    this.schema = { tables: Object.fromEntries(filtered) }
  }

  getHookName(name: string, operation: Operation) {
    return `use${operation}${name}`
  }

  generate() {
    const typeGenerator = new TypeGenerator(this.schema)
    const hooks = Object.entries(this.schema.tables)
      .map(([name, table]) => {
        const hookName = this.getHookName(typeGenerator.getEntityName(name), Operation.READ)
        return hookName
      })
      .join('\n\n')

    return new HookObject(hooks)
  }

  #generateFields(columns: Record<string, Field<ColumnDefinition>>) {
    return Object.values(columns)
      .map((column) => `  ${column.toInterface()}`)
      .join('\n')
  }
}
