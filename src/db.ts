import { Database as SQLite } from 'sqlite3'
import { logger } from './logger'

export class Database {
  static #instance: SQLite
  #isReady: boolean

  constructor(db: string) {
    Database.#instance = new SQLite(db, (err) => {
      if (err) {
        logger.error(`Failed to open database connection with error: ${err.message}`)
        return
      }
      logger.info('Opened database connection')
      this.#isReady = true
    })
  }

  get instance() {
    return Database.#instance
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.#isReady) {
        logger.error('Database connection is not open')
        reject()
      } else {
        Database.#instance.close((err) => {
          if (err) {
            logger.error(`Failed to close database connection with error: ${err.message}`)
            reject(err)
          } else {
            logger.info('Closed database connection')
            this.#isReady = false
            resolve()
          }
        })
      }
    })
  }
}
