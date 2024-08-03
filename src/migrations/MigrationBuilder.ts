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

    // When both tables exist, diff them
    for (const table of targetTableNames) {
      if (currentTableNames.includes(table)) {
        const currentTable = current.getTable(table)!
        const targetTable = target.getTable(table)!

        this.diffTables(currentTable, targetTable, upMigrations, downMigrations)
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

  /**
   * Diff two tables and generate migrations
   * SQLite3 does not support ALTER TABLE for modifying structure,
   * so we need to create a new table and copy the data
   * @param current Current table
   * @param target Target table
   * @param upMigrations Array to store up migrations
   * @param downMigrations Array to store down migrations
   */
  private static diffTables(
    current: TableDefinition,
    target: TableDefinition,
    upMigrations: string[],
    downMigrations: string[]
  ) {
    const currentColumns = Object.keys(current.columns)
    const targetColumns = Object.keys(target.columns)

    const name = target.map || target.name

    const renameAndRecreateTable = (tableName: string, target: TableDefinition, migrations: string[]) => {
      migrations.push('BEGIN TRANSACTION;')
      migrations.push(`ALTER TABLE ${tableName} RENAME TO ${tableName}_old;`)
      migrations.push(this.createTable(tableName, target))
      migrations.push(`DROP TABLE ${tableName}_old;`)
      migrations.push('COMMIT;')
    }

    // Helper function to check if there are both added and removed columns
    const hasChangedColumns = (current: TableDefinition['columns'], target: TableDefinition['columns']) => {
      const currentCols = Object.keys(current)
      const targetCols = Object.keys(target)

      const added = targetCols.some((col) => !currentCols.includes(col))
      const removed = currentCols.some((col) => !targetCols.includes(col))
      return added || removed
    }

    // If there are both added and removed columns, rebuild the table
    if (hasChangedColumns(current.columns, target.columns)) {
      renameAndRecreateTable(name, target, upMigrations)
      renameAndRecreateTable(name, current, downMigrations)
    } else {
      // Columns to modify
      for (const column of targetColumns) {
        if (currentColumns.includes(column)) {
          const currentColumn = current.columns[column]
          const targetColumn = target.columns[column]

          if (currentColumn.toSQL() !== targetColumn.toSQL()) {
            renameAndRecreateTable(name, target, upMigrations)
            renameAndRecreateTable(name, current, downMigrations)
          }
        }
      }
    }
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
