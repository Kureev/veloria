import { DatabaseSchema, TableDefinition } from './types'

interface Diff {
  added: TableDefinition[]
  removed: TableDefinition[]
  changed: TableDefinition[]
}

export class SchemaDiff {
  /**
   * Create a new SchemaDiff instance
   * @param schema The SQL schema to compare against
   */
  constructor(private schema: DatabaseSchema) {}

  diff(schema: DatabaseSchema): Diff {
    const added = this.getAddedTables(schema)
    const removed = this.getRemovedTables(schema)
    const changed = this.getChangedTables(schema)

    return { added, removed, changed }
  }

  private getAddedTables(schema: DatabaseSchema): TableDefinition[] {
    return Object.entries(schema.tables)
      .filter(([name]) => !this.schema.tables[name])
      .map(([, table]) => table)
  }

  private getRemovedTables(schema: DatabaseSchema): TableDefinition[] {
    return Object.entries(this.schema.tables)
      .filter(([name]) => !schema.tables[name])
      .map(([, table]) => table)
  }

  private getChangedTables(schema: DatabaseSchema): TableDefinition[] {
    return Object.entries(schema.tables)
      .filter(([name, table]) => {
        const currentTable = this.schema.tables[name]
        return currentTable && JSON.stringify(currentTable) !== JSON.stringify(table)
      })
      .map(([, table]) => table)
  }
}