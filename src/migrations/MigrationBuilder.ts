import { DatabaseSchema, TableDefinition, IndexDefinition, ForeignKeyDefinition } from './types'

export class MigrationBuilder {
  static generate(current: DatabaseSchema, target: DatabaseSchema): { up: string; down: string } {
    const upMigrations: string[] = []
    const downMigrations: string[] = []

    const currentTableNames = current.getMappedTableNames()
    const targetTableNames = target.getMappedTableNames()

    // Tables to create
    for (const table of targetTableNames) {
      if (!currentTableNames.includes(table)) {
        upMigrations.push(this.createTable(table, target.getTable(table)!))
        downMigrations.push(this.dropTable(table))
      }
    }

    // Tables to drop
    for (const table of currentTableNames) {
      if (!targetTableNames.includes(table)) {
        downMigrations.push(this.createTable(table, current.getTable(table)!))
        upMigrations.push(this.dropTable(table))
      }
    }

    // Handle indexes
    for (const table of targetTableNames) {
      const currentIndexes = current.getTable(table)?.indexes || []
      const targetIndexes = target.getTable(table)!.indexes || []

      // Indexes to create
      for (const index of targetIndexes) {
        if (!currentIndexes.some((i) => i.name === index.name)) {
          upMigrations.push(this.createIndex(table, index))
          downMigrations.push(this.dropIndex(index.name))
        }
      }

      // Indexes to drop
      for (const index of currentIndexes) {
        if (!targetIndexes.some((i) => i.name === index.name)) {
          downMigrations.push(this.createIndex(table, index))
          upMigrations.push(this.dropIndex(index.name))
        }
      }
    }

    return { up: upMigrations.join('\n'), down: downMigrations.join('\n') }
  }

  private static createTable(name: string, schema: TableDefinition): string {
    const columns = Object.entries(schema.columns).map(([, column]) => column.toSQL())

    const foreignKeys =
      schema.foreignKeys?.map((fk: ForeignKeyDefinition) => {
        const references = fk.references.join(', ')
        const referencedColumns = fk.referencedColumns.join(', ')
        const onUpdate = fk.onUpdate ? `ON UPDATE ${this.mapReferentialAction(fk.onUpdate)}` : ''
        const onDelete = fk.onDelete ? `ON DELETE ${this.mapReferentialAction(fk.onDelete)}` : ''
        return `FOREIGN KEY (${references}) REFERENCES \`${fk.referencedTable}\`(${referencedColumns}) ${onUpdate} ${onDelete}`
      }) || []

    const fields = [...columns, ...foreignKeys].join(', ')

    return `CREATE TABLE IF NOT EXISTS ${name} (${fields});`
  }

  private static dropTable(name: string): string {
    return `DROP TABLE IF EXISTS ${name};`
  }

  private static createIndex(table: string, index: IndexDefinition): string {
    const columns = index.columns.join(', ')
    return `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${index.name} ON \`${table}\`(${columns});`
  }

  private static dropIndex(indexName: string): string {
    return `DROP INDEX IF EXISTS ${indexName};`
  }

  private static mapReferentialAction(action: string): string | undefined {
    switch (action) {
      case 'NoAction':
        return 'NO ACTION'
      case 'Cascade':
        return 'CASCADE'
      case 'SetNull':
        return 'SET NULL'
      case 'SetDefault':
        return 'SET DEFAULT'
      case 'Restrict':
        return 'RESTRICT'
    }
  }
}
