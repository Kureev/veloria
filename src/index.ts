import path from 'node:path'
import { Database } from './db'
import { Parser } from './parser'
import { Migrator } from './migrations/Migrator'
import { Converter } from './migrations/prisma/Converter'

async function main(schemaPath: string) {
  const parser = new Parser(schemaPath)
  // const datasource = parser.getDatasource()
  // const db = new Database(datasource)

  const converter = new Converter(parser.getSchema())
  const schema = converter.toSchema()

  // console.log(parser.getModelSchema('User').members.filter((member) => member.kind === 'blockAttribute'))
  console.log(schema.tables.User)

  // const migrator = new Migrator(db, parser)
  // await migrator.migrate()

  // await db.close()
}

const schemaPath = path.resolve(path.resolve(__dirname, '..', '__fixtures__', 'schema.prisma'))

main(schemaPath)
