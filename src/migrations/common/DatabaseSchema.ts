import { DatabaseSchema as DatabaseSchemaInterface, TableDefinition } from '../types'

export class DatabaseSchema implements DatabaseSchemaInterface {
  constructor(private tables: Record<string, TableDefinition>) {}

  getTableNames() {
    return Object.keys(this.tables)
  }

  getMappedTableNames() {
    return Object.entries(this.tables).reduce((acc, [name, table]) => {
      acc.push(table.map || name)
      return acc
    }, [] as string[])
  }

  getTables() {
    return this.tables
  }

  getMappedTables() {
    return Object.entries(this.tables).reduce(
      (acc, [name, table]) => {
        if (table.map) {
          acc[table.map] = table
        }
        return acc
      },
      {} as Record<string, TableDefinition>
    )
  }

  addTable(name: string, table: TableDefinition) {
    this.tables[name] = table
  }

  getTable(name: string) {
    if (this.tables[name]) {
      return this.tables[name]
    }

    const table = Object.entries(this.tables).find(([key, table]) => {
      if (table.map === name) {
        return table
      }
    })

    return table?.[1]
  }
}
