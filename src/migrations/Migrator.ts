import { Database } from 'sqlite3'
import { logger } from '../logger'
import { DatabaseSchema, TableDefinition } from './types'

const MIGRATIONS_TABLE = 'migrations'

export class Migrator {
  #db: Database

  constructor(db: Database) {
    this.#db = db
  }

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
    return new Promise((resolve) => {
      this.#db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${MIGRATIONS_TABLE}'`, (err, row) => {
        if (err) {
          logger.error(err)
          resolve(false)
        } else {
          resolve(row !== undefined)
        }
      })
    })
  }

  /**
   * Create the migration table in the database
   * @returns Promise<void>
   */
  async #createMigrationTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#db.run(
        [
          `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE}`,
          `(id INTEGER PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        ].join(' '),
        (err) => {
          if (err) {
            logger.error(err)
            reject()
          }
          resolve()
        }
      )
    })
  }

  async #createTable(name: string, schema: TableDefinition): Promise<void> {
    const columns = Object.entries(schema.columns)
      .map(([name, column]) => {
        const parts = [name, column.type]
        if (column.notNull) {
          parts.push('NOT NULL')
        }
        if (column.primaryKey) {
          parts.push('PRIMARY KEY')
        }
        if (column.unique) {
          parts.push('UNIQUE')
        }
        if (column.default) {
          parts.push(column.default)
        }
        return parts.join(' ')
      })
      .join(', ')

    return this.#run(`CREATE TABLE IF NOT EXISTS ${schema.map ?? name} (${columns})`)
  }

  async #createIndexes(name: string, schema: TableDefinition): Promise<void> {
    const indexes = schema.indexes?.map((index) => {
      const columns = index.columns.join(', ')
      return `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${index.name} ON ${name} (${columns})`
    })

    if (!indexes) {
      return
    }

    await Promise.all(indexes.map((sql) => this.#run(sql)))
  }

  async #run(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#db.run(sql, (err) => {
        if (err) {
          logger.error(err)
          reject()
        }
        resolve()
      })
    })
  }
}
