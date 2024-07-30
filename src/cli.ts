import { Migrator } from './migrations/Migrator'
import { Parser } from './parser'
import { Converter as PrismaConverter } from './migrations/prisma/Converter'
import { Converter as SQLiteConverter } from './migrations/sqlite/Converter'
import SQLite from 'sqlite3'
import { program } from 'commander'
import path from 'path'

program.version('0.1.0').name('veloria')

program
  .command('migrate <schema>')
  .usage('assets/schema.prisma')
  .description('Create a new migration')
  .action(async (schemaPath) => {
    const parser = new Parser(path.resolve(process.cwd(), schemaPath))
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
  .command('migrate:up')
  .description('Migrate the database to match the schema')
  .action(() => {
    console.log('Migrating up...')
    program.command('migrate:up').description('Migrate the database to match the schema')
  })

program.command('migrate:down').description('Revert the last migration')

program.parse(process.argv)
