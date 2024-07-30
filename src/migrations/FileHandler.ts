import fs from 'fs'
import path from 'path'
import { findProjectRoot } from '../utils'
import { logger } from '../logger'

const MIGRATIONS_DIR = path.join(findProjectRoot(process.cwd()), 'migrations')

function compareVersions(a: string, b: string): number {
  const aVersion = parseInt(a.split('_')[0])
  const bVersion = parseInt(b.split('_')[0])

  return aVersion - bVersion
}

export class FileHandler {
  static ensureMigrationsDir(): void {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      fs.mkdirSync(MIGRATIONS_DIR)
    }
  }

  static readUpMigrations(): [string, string][] {
    FileHandler.ensureMigrationsDir()

    return fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('up.sql'))
      .sort((a, b) => compareVersions(a, b))
      .map((file) => [file, fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')])
  }

  static readDownMigrations(): [string, string][] {
    FileHandler.ensureMigrationsDir()

    return fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('down.sql'))
      .sort((a, b) => compareVersions(a, b))
      .map((file) => [file, fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')])
  }

  static writeMigrationFile(filename: string, content: string): void {
    FileHandler.ensureMigrationsDir()

    const filePath = path.join(MIGRATIONS_DIR, filename)
    fs.writeFileSync(filePath, content)
  }

  static async removeFile(filePath: string): Promise<void> {
    try {
      fs.unlinkSync(filePath)
    } catch (error) {
      logger.error(`Error removing file ${filePath}:`, error)
    }
  }
}
