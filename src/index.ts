import path from 'node:path'
import { Parser } from './parser'
import { Migrator } from './migrations/Migrator'
import { Converter as PrismaConverter } from './migrations/prisma/Converter'
import { Converter as SQLiteConverter } from './migrations/sqlite/Converter'
import { Database } from 'sqlite3'
import { TypeGenerator } from './types/TypeGenerator'
import { HooksGenerator } from './hooks/HooksGenerator'
import { EntryPointGenerator } from './entry/EntryPointGenerator'

const outputFolder = path.resolve(__dirname, '..', 'node_modules', '@veloria/client')

async function main(schemaPath: string) {
  const parser = new Parser(schemaPath)
  const datasource = parser.getDatasource()

  const prismaConverter = new PrismaConverter(parser.getSchema())
  const schema = prismaConverter.toSchema()
  const db = new Database(datasource)

  console.log(schema.tables.User)

  const sqliteConverter = new SQLiteConverter(db)
  const sqliteSchema = await sqliteConverter.toSchema()

  const migrator = new Migrator(db)
  await migrator.migrate(schema)

  const typeGenerator = new TypeGenerator(schema)
  const types = typeGenerator.generate()
  const typePath = path.resolve(outputFolder, 'schema.ts')
  types.save(typePath)

  const hookGenerator = new HooksGenerator(schema)
  const hooksPath = path.resolve(outputFolder, 'hooks.ts')
  const hooks = hookGenerator.generate()

  hooks.save(hooksPath)

  EntryPointGenerator.generate()
}

const schemaPath = path.resolve(path.resolve(__dirname, '..', '__fixtures__', 'schema.prisma'))

main(schemaPath)
