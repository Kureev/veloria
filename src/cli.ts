import { Migrator } from './migrations/Migrator'
import { Parser } from './parser'
import { Converter as PrismaConverter } from './migrations/prisma/Converter'
import { Converter as SQLiteConverter } from './migrations/sqlite/Converter'
import { TypeGenerator } from './types/TypeGenerator'
import { HooksGenerator } from './hooks/HooksGenerator'
import { EntryPointGenerator } from './entry/EntryPointGenerator'
import SQLite from 'sqlite3'
import { program } from 'commander'
import path from 'path'
import { findProjectRoot } from './utils'

const ROOT = findProjectRoot(process.cwd())
const DEFAULT_SCHEMA_PATH = path.resolve(ROOT, 'assets', 'schema.prisma')
const OUTPUT_FOLDER = path.resolve(ROOT, 'node_modules', '@veloria', 'client')

program.version('0.1.0').name('veloria')

program
  .command('migrate [schema]')
  .usage('assets/schema.prisma')
  .description('Create a new migration')
  .action(async (schemaPath) => {
    const file = schemaPath ? path.resolve(process.cwd(), schemaPath) : DEFAULT_SCHEMA_PATH
    const parser = new Parser(file)
    const prismaConverter = new PrismaConverter(parser.getSchema())
    const schema = prismaConverter.toSchema()

    const datasource = parser.getDatasource()
    const db = new SQLite.Database(datasource)
    const tmpDB = new SQLite.Database(':memory:')

    const sqliteConverter = new SQLiteConverter(tmpDB)
    await sqliteConverter.applyMigrations()
    const sqliteSchema = await sqliteConverter.toSchema()

    const migrator = new Migrator(db)
    await migrator.migrate(sqliteSchema, schema)
  })

program
  .command('generate [schema]')
  .description('Generate @veloria/client')
  .action((schemaPath) => {
    const file = schemaPath ? path.resolve(process.cwd(), schemaPath) : DEFAULT_SCHEMA_PATH
    const parser = new Parser(file)
    const prismaConverter = new PrismaConverter(parser.getSchema())

    const datasource = parser.getDatasource()
    const schema = prismaConverter.toSchema()

    const typeGenerator = new TypeGenerator(schema)
    const types = typeGenerator.generate()
    const typePath = path.resolve(OUTPUT_FOLDER, 'types.ts')
    types.save(typePath)

    const hookGenerator = new HooksGenerator(schema)
    const hooks = hookGenerator.generate()

    hooks.forEach((hook) => {
      const output = path.resolve(OUTPUT_FOLDER, 'hooks', `${hook.name}.ts`)
      hook.save(output)
    })

    EntryPointGenerator.generate(datasource, hooks)
  })

program.parse(process.argv)
