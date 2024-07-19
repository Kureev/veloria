import { Database } from 'sqlite3'
import { logger } from '../logger'

export abstract class BaseSQLite {
  #db: Database

  constructor(db: Database) {
    this.#db = db
  }

  protected async run(sql: string): Promise<void> {
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

  protected all<T>(sql: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.#db.all<T>(sql, (err, rows) => {
        if (err) {
          logger.error(err)
          reject()
        }
        resolve(rows)
      })
    })
  }

  protected get<T>(sql: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.#db.get<T>(sql, (err, row) => {
        if (err) {
          logger.error(err)
          reject()
        }
        resolve(row)
      })
    })
  }
}
