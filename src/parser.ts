import { readFileSync } from 'node:fs'
import {
  type BlockAttribute,
  type Config,
  type ConfigBlock,
  type FieldDeclaration,
  type ModelDeclaration,
  type PrismaSchema,
  type ScalarLiteral,
  parsePrismaSchema,
} from '@loancrate/prisma-schema-parser'
import path from 'node:path'

export class Parser {
  #ast: PrismaSchema
  #schemaPath: string

  constructor(schemaPath: string) {
    this.#schemaPath = schemaPath
    this.#ast = parsePrismaSchema(readFileSync(schemaPath, { encoding: 'utf8' }))
  }

  getSchema(): PrismaSchema {
    return this.#ast
  }

  /**
   * Get the datasource URL from the schema
   * @returns string
   */
  getDatasource(): string {
    const ds = this.#ast.declarations.find(({ kind }) => kind === 'datasource') as ConfigBlock
    const config = ds.members.find((config: Config) => config.name.value === 'url') as Config

    const value = (config.value as ScalarLiteral).value as string
    const databasePath = value.match(/file:(.*)/)?.[1] || value
    return path.resolve(path.dirname(this.#schemaPath), databasePath)
  }

  /**
   * Get all models in the schema
   * @returns ModelDeclaration[]
   */
  getModels(): ModelDeclaration[] {
    return this.#ast.declarations.filter(({ kind }) => kind === 'model') as ModelDeclaration[]
  }

  /**
   * Get the names of all models in the schema
   * @returns string[]
   */
  getModelNames(): string[] {
    return this.getModels().map((model) => model.name.value)
  }

  /**
   * Get the schema for a specific model
   * @param modelName Name of the model
   * @returns ModelDeclaration
   */
  getModelSchema(modelName: string): ModelDeclaration {
    return this.getModels().find((model) => model.name.value === modelName)
  }

  /**
   * Get the fields for a specific model
   * @param modelName Name of the model
   * @returns FieldDeclaration[]
   */
  getModelFields(modelName: string): FieldDeclaration[] {
    const model = this.getModelSchema(modelName)
    return (model?.members.filter((member) => member.kind === 'field') as FieldDeclaration[]) || []
  }

  getModelBlockAttributes(modelName: string): BlockAttribute[] {
    const model = this.getModelSchema(modelName)
    return (model?.members.filter((member) => member.kind === 'blockAttribute') as BlockAttribute[]) || []
  }
}
