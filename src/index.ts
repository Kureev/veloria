import path from 'node:path'
import { Parser } from './parser'
import { Migrator } from './migrations/Migrator'
import { Converter as PrismaConverter } from './migrations/prisma/Converter'
import { Converter as SQLiteConverter } from './migrations/sqlite/Converter'
import { Database } from 'sqlite3'

async function main(schemaPath: string) {
  const parser = new Parser(schemaPath)
  const datasource = parser.getDatasource()

  const prismaConverter = new PrismaConverter(parser.getSchema())
  const schema = prismaConverter.toSchema()
  const db = new Database(datasource)

  // console.log(schema.tables.Report)

  const sqliteConverter = new SQLiteConverter(db)
  const sqliteSchema = await sqliteConverter.toSchema()

  console.log(sqliteSchema.tables.Report)

  const migrator = new Migrator(db)
  await migrator.migrate(schema)

  // await db.close()
}

const schemaPath = path.resolve(path.resolve(__dirname, '..', '__fixtures__', 'schema.prisma'))

main(schemaPath)
