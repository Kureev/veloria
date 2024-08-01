import { type BlockAttribute, type ModelDeclaration, type PrismaSchema } from '@loancrate/prisma-schema-parser'
import { DatabaseSchema } from '../common/DatabaseSchema'
import { Table } from './Table'

import { type TableDefinition } from '../types'

export class Converter {
  #schema: PrismaSchema

  constructor(schema: PrismaSchema) {
    this.#schema = schema
  }

  /**
   * Convert Prisma schema to intermediate representation
   * @returns Intermediate representation of the database schema
   */
  toSchema(): DatabaseSchema {
    const models = this.#schema.declarations.filter(({ kind }) => kind === 'model') as ModelDeclaration[]
    const tables: Record<string, TableDefinition> = models.reduce(
      (acc, model: ModelDeclaration) => {
        if (!this.#isIgnored(model)) {
          acc[model.name.value] = new Table(model, this.#schema)
        }
        return acc
      },
      {} as Record<string, TableDefinition>
    )
    return new DatabaseSchema(tables)
  }

  /**
   * Check if the model is ignored
   * @param model Model to check
   * @returns `true` if the model is ignored, `false` otherwise
   */
  #isIgnored(model: ModelDeclaration): boolean {
    const blockAttributes = model.members.filter(({ kind }) => kind === 'blockAttribute') as BlockAttribute[]
    return blockAttributes.some((block) => {
      return block.path.value[0] === 'ignore'
    })
  }
}
