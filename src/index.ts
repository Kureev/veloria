import path from 'node:path'
import { Database } from './db'
import { Parser } from './parser'
import { Migrator } from './migrations/Migrator'

async function main(schemaPath: string) {
  const parser = new Parser(schemaPath)
  const datasource = parser.getDatasource()
  const db = new Database(datasource)

  const migrator = new Migrator(db, parser)
  await migrator.migrate()

  await db.close()
}

const schemaPath = path.resolve(path.resolve(__dirname, '..', '__fixtures__', 'schema.prisma'))

main(schemaPath)
