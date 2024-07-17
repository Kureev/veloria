import { plural, singular } from 'pluralize'
import { Database } from '../db'
import { logger } from '../logger'
import { Parser } from '../parser'

type Table = {
  name: string
}

export class Migrator {
  #db: Database
  #parser: Parser

  constructor(db: Database, parser: Parser) {
    this.#db = db
    this.#parser = parser
  }

  /**
   * Migrate the database to match the schema
   * @returns Promise<void>
   */
  async migrate(): Promise<void> {
    await this.#setupMigrationTable()

    const schemaModelNames = this.#parser.getModelNames()
    const existingTableNames = await this.#fetchTableNames()

    const newModels = schemaModelNames.filter((model) => !existingTableNames.includes(this.#convertToTableName(model)))
    const deletedModels = existingTableNames.filter(
      (table) => !schemaModelNames.includes(this.#convertToModelName(table))
    )
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
   * Table names are plural and lowercase. Model names are singular and capitalized.
   * Function converts model names to table names.
   * @param model Model name
   * @returns Table name
   */
  #convertToTableName(model: string): string {
    return plural(model).toLowerCase()
  }

  /**
   * Table names are plural and lowercase. Model names are singular and capitalized.
   * Function converts table names to model names.
   * @param table Table name
   * @returns Model name
   */
  #convertToModelName(table: string): string {
    const singularName = singular(table)
    return singularName.charAt(0).toUpperCase() + singularName.slice(1)
  }

  /**
   * Returns a promise that resolves to a boolean indicating whether the migrations table exists
   * @returns Promise<boolean>
   */
  async #hasMigrationTable(): Promise<boolean> {
    return new Promise((resolve) => {
      this.#db.instance.get("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'", (err, row) => {
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
      this.#db.instance.run(
        `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
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

  /**
   * Fetch all tables in the database excluding system tables and the `migration` table
   * @returns Promise<string[]>
   */
  #fetchTableNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.#db.instance.all<Table>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations';",
        (err, rows) => {
          if (err) {
            reject(err)
          } else {
            resolve(rows.map((row) => row.name))
          }
        }
      )
    })
  }
}
