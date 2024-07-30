import { DatabaseSchema } from './types'
import { BaseSQLite } from './BaseSQLite'
import { MigrationBuilder } from './MigrationBuilder'
import { FileHandler } from './FileHandler'
import { logger } from '../logger'

export class Migrator extends BaseSQLite {
  /**
   * Generate and apply migrations to the database
   * @param current The current database schema
   * @param upstream The desired database schema
   * @returns Promise<void>
   */
  async migrate(current: DatabaseSchema, upstream: DatabaseSchema): Promise<void> {
    const { up, down } = MigrationBuilder.generate(current, upstream)

    if (!up.length) {
      logger.info('No migrations to apply')
      return
    }

    const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '')
    FileHandler.writeMigrationFile(`${timestamp}_up.sql`, up)
    if (down) {
      FileHandler.writeMigrationFile(`${timestamp}_down.sql`, down)
    }

    return this.exec(up)
  }
}
