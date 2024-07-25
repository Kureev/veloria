import { logger } from '../logger'
import { DatabaseSchema, ForeignKeyDefinition, TableDefinition } from './types'
import { BaseSQLite } from './BaseSQLite'

const MIGRATIONS_TABLE = 'migrations'

export class Migrator extends BaseSQLite {
  /**
   * Migrate the database to match the schema
   * @returns Promise<void>
   */
  async migrate(schema: DatabaseSchema): Promise<void> {
    await this.#setupMigrationTable()

    const queue = Object.entries(schema.tables).filter(([, table]) => !table.ignore)

    const tables = queue.map(async ([name, table]) => this.#createTable(name, table))
    await Promise.all(tables)

    const indexes = queue.map(async ([name, table]) => this.#createIndexes(name, table))
    await Promise.all(indexes)

    logger.info('Migration complete')
  }

  /**
   * Initialize the database by creating the migration table if it does not exist
   */
  async #setupMigrationTable(): Promise<void> {
    let migrationTable: boolean = false

    try {
      migrationTable = await this.#hasMigrationTable()
    } catch (err) {
      logger.error(`Failed to check if migration table exists ${(err as Error).message}`)
    }

    if (migrationTable === false) {
      logger.info('Creating migration table...')
      try {
        await this.#createMigrationTable()
      } catch (err) {
        logger.error(`Failed to set up migration table ${(err as Error).message}`)
      }
      logger.info('Migration table created')
    }

    logger.info('Database initialized')
  }

  /**
   * Returns a promise that resolves to a boolean indicating whether the migrations table exists
   * @returns Promise<boolean>
   */
  async #hasMigrationTable(): Promise<boolean> {
    const rows = this.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${MIGRATIONS_TABLE}'`)
    return rows != undefined
  }

  /**
   * Create the migration table in the database
   * @returns Promise<void>
   */
  async #createMigrationTable(): Promise<void> {
    try {
      await this.run(
        [
          `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE}`,
          `(id INTEGER PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        ].join(' ')
      )
    } catch (err) {
      logger.error(err)
    }
  }

  async #createTable(name: string, schema: TableDefinition): Promise<void> {
    const columns = Object.entries(schema.columns).map(([, column]) => column.toSQL())

    const foreignKeys =
      schema.foreignKeys?.map((fk: ForeignKeyDefinition) => {
        const references = fk.references.join(', ')
        const referencedColumns = fk.referencedColumns.join(', ')
        const onUpdate = fk.onUpdate ? `ON UPDATE ${this.#mapReferencialAction(fk.onUpdate)}` : ''
        const onDelete = fk.onDelete ? `ON DELETE ${this.#mapReferencialAction(fk.onDelete)}` : ''
        return `FOREIGN KEY (${references}) REFERENCES \`${fk.referencedTable}\`(${referencedColumns}) ${onUpdate} ${onDelete}`
      }) || []

    const fields = [...columns, ...foreignKeys].join(', ')

    const query = `CREATE TABLE IF NOT EXISTS ${schema.map ?? name} (${fields})`

    await this.run(`PRAGMA foreign_keys=OFF`)
    await this.run(query)
    await this.run(`PRAGMA foreign_keys=ON`)
  }

  async #createIndexes(name: string, schema: TableDefinition): Promise<void> {
    const indexes = schema.indexes?.map((index) => {
      const columns = index.columns.join(', ')
      return `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${index.name} ON ${name} (${columns})`
    })

    if (!indexes) {
      return
    }

    await Promise.all(indexes.map((sql) => this.run(sql)))
  }

  /**
   * Map referencial action to SQLite referencial action
   * @param action Prisma referencial action
   * @returns SQLite referencial action
   */
  #mapReferencialAction(action: string): string | undefined {
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
