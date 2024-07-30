import path from 'path'
import { Parser } from './parser'
import { Converter as PrismaConverter } from './migrations/prisma/Converter'
import { TypeGenerator } from './types/TypeGenerator'
import { HooksGenerator } from './hooks/HooksGenerator'
import { EntryPointGenerator } from './entry/EntryPointGenerator'

const outputFolder = path.resolve(process.cwd(), 'node_modules', '@veloria', 'client')

async function main(schemaPath: string) {
  const parser = new Parser(schemaPath)
  const prismaConverter = new PrismaConverter(parser.getSchema())

  const datasource = parser.getDatasource()
  const schema = prismaConverter.toSchema()

  const typeGenerator = new TypeGenerator(schema)
  const types = typeGenerator.generate()
  const typePath = path.resolve(outputFolder, 'types.ts')
  types.save(typePath)

  const hookGenerator = new HooksGenerator(schema)
  const hooks = hookGenerator.generate()

  hooks.forEach((hook) => {
    const output = path.resolve(outputFolder, 'hooks', `${hook.name}.ts`)
    hook.save(output)
  })

  EntryPointGenerator.generate(datasource, hooks)
}

const schemaPath = path.resolve(process.cwd(), '__fixtures__', 'schema.prisma')

main(schemaPath)
