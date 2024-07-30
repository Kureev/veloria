import { DatabaseSchema, TableDefinition, IndexDefinition, ForeignKeyDefinition } from './types'

export class MigrationBuilder {
  static generate(current: DatabaseSchema, target: DatabaseSchema): { up: string; down: string } {
    const upMigrations: string[] = []
    const downMigrations: string[] = []

    const currentTables = Object.keys(current.tables)
    const targetTables = Object.keys(target.tables)

    // Tables to create
    for (const table of targetTables) {
      if (!currentTables.includes(table)) {
        upMigrations.push(this.createTable(table, target.tables[table]))
        downMigrations.push(this.dropTable(table))
      }
    }

    // Tables to drop
    for (const table of currentTables) {
      if (!targetTables.includes(table)) {
        downMigrations.push(this.createTable(table, current.tables[table]))
        upMigrations.push(this.dropTable(table))
      }
    }

    // Handle indexes
    for (const table of targetTables) {
      const currentIndexes = current.tables[table]?.indexes || []
      const targetIndexes = target.tables[table].indexes || []

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

    return `CREATE TABLE IF NOT EXISTS ${schema.map ?? name} (${fields});`
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
