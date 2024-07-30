import { Database } from 'sqlite3'
import { logger } from '../logger'
import { FileHandler } from './FileHandler'

const MIGRATIONS_TABLE = '__migrations__'

export abstract class BaseSQLite {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  protected getMigrationsTableName(): string {
    return MIGRATIONS_TABLE
  }

  protected async run(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, (err) => {
        if (err) {
          logger.error(err)
          reject()
        }
        resolve()
      })
    })
  }

  protected async all<T>(sql: string): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      this.db.all<T>(sql, (err, rows) => {
        if (err) {
          logger.error(err)
          reject()
        }
        resolve(rows)
      })
    })
  }

  protected async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) {
          logger.error(err)
          reject()
        }
        resolve()
      })
    })
  }

  protected get<T>(sql: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.get<T>(sql, (err, row) => {
        if (err) {
          logger.error(err)
          reject()
        }
        resolve(row)
      })
    })
  }

  protected async setupMigrationsTable(): Promise<unknown> {
    return this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.getMigrationsTableName()} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
  }

  /**
   * Record a migration as applied
   * @param filename The filename of the migration
   */
  protected async recordMigration(filename: string): Promise<unknown> {
    return this.db.run(`INSERT INTO ${this.getMigrationsTableName()} (filename) VALUES ('${filename}')`)
  }

  protected async getAppliedMigrations(): Promise<string[]> {
    const rows = await this.all<{ filename: string }>(`SELECT filename FROM ${this.getMigrationsTableName()};`)
    return rows.map((row) => row.filename)
  }

  public async applyMigrations() {
    await this.setupMigrationsTable()

    const appliedMigrations = await this.getAppliedMigrations()
    const migrations = FileHandler.readUpMigrations()

    logger.debug(`Applied migrations: ${appliedMigrations.join(', ')}`)

    const queue = migrations
      .filter(([migration]) => {
        return !appliedMigrations.includes(migration)
      })
      .map(([name, sql]) => {
        logger.debug(`Applying migration: ${name}`)

        return new Promise<void>(async (resolve) => {
          await this.exec(sql)
          logger.debug(`Migration applied: ${name}`)
          await this.recordMigration(name)
          logger.debug(`Migration recorded: ${name}`)
          await this.getAppliedMigrations()
          resolve()
        })
      })

    await Promise.all(queue)
  }
}
