import {
  BlockAttribute,
  findDefaultFieldAttribute,
  findMapFieldAttribute,
  getArgument,
  getArgumentExpression,
  getArgumentValues,
  getArgumentValuesObject,
  getDeclarationName,
  getExpressionValue,
  type FieldDeclaration,
  type ModelDeclaration,
  type PrismaSchema,
} from '@loancrate/prisma-schema-parser'
import { getTypeValue } from './getTypeValue'
import { getDefaultAttributeValue } from './getDefaultAttributeValue'

import {
  type DatabaseSchema,
  type ForeignKeyDefinition,
  type ColumnDefinition,
  type IndexDefinition,
  type TableDefinition,
} from '../types'

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
    return {
      tables: models.reduce(
        (acc, model: ModelDeclaration) => {
          acc[model.name.value] = this.#convertPrismaModelToSchemaTable(model)
          return acc
        },
        {} as Record<string, TableDefinition>
      ),
    }
  }

  /**
   * Find primary keys in the fields
   * @param fields Fields to search for primary keys
   * @returns List of primary keys
   */
  #findPrimaryKeys(fields: FieldDeclaration[]): string[] {
    return fields
      .filter((field) => field.attributes?.some((attr) => attr.path.value[0] === 'id'))
      .map((field) => field.name.value)
  }

  /**
   * Find foreign keys in the fields
   * @param fields Fields to search for foreign keys
   * @returns List of foreign keys
   */
  #findForeignKeys(fields: FieldDeclaration[]): Record<string, ForeignKeyDefinition> {
    return fields.reduce(
      (acc, field: FieldDeclaration) => {
        const relation = field.attributes?.find((attr) => attr.path.value[0] === 'relation')
        if (!relation) return acc

        const namedArguments = relation.args!.filter((arg) => arg.kind === 'namedArgument')
        const args = getArgumentValuesObject(namedArguments)

        acc[field.name.value] = {
          referencedTable: getTypeValue(field.type),
          references: args.fields,
          referencedColumn: args.references,
          onUpdate: this.#mapReferencialAction(args.onUpdate as string),
          onDelete: this.#mapReferencialAction(args.onDelete as string),
        } as ForeignKeyDefinition

        return acc
      },
      {} as Record<string, ForeignKeyDefinition>
    )
  }

  /**
   * Format columns to a map of column names to column definitions
   * @param fields Fields to format
   * @returns Map of column names to column definitions
   */
  #formatColumns(fields: FieldDeclaration[]): Record<string, ColumnDefinition> {
    return fields.reduce(
      (acc, field: FieldDeclaration) => {
        const column = this.#convertPrismaFieldToSchemaColumn(field)

        if (column) {
          acc[field.name.value] = column
        }

        return acc
      },
      {} as Record<string, ColumnDefinition>
    )
  }

  /**
   * Find indexes in the block attributes
   * @param blocks Block attributes to search for indexes
   * @returns List of indexes
   */
  #findIndexes(blocks: BlockAttribute[]): IndexDefinition[] {
    return blocks.reduce((acc, block: BlockAttribute) => {
      if (getExpressionValue(block.path) === 'index') {
        const args = getArgumentValues(block.args!) as [string[], string]
        acc.push({
          columns: args[0],
          name: args[1],
        })
      }
      return acc
    }, [] as IndexDefinition[])
  }

  /**
   * Check if the model is ignored
   * @param model Model to check
   * @returns `true` if the model is ignored, `false` otherwise
   */
  #isIgnored(model: ModelDeclaration): boolean {
    const blockAttributes = model.members.filter(({ kind }) => kind === 'blockAttribute') as BlockAttribute[]
    return blockAttributes.some((block) => {
      return (getExpressionValue(block.path) as [string])[0] === 'ignore'
    })
  }

  /**
   * Find the mapped table name in the block attributes
   * @param model Model to search for the mapped table name
   * @returns Mapped table name
   */
  #findMappedTableName(model: ModelDeclaration): string | undefined {
    const blocks = model.members.filter(({ kind }) => kind === 'blockAttribute') as BlockAttribute[]

    const block = blocks.find((block) => getExpressionValue(block.path) === 'map')

    if (block) {
      const arg = getArgument(block.args, 'name')
      const value = getExpressionValue(getArgumentExpression(arg))
      return value as string
    }
  }

  /**
   * Convert Prisma model to schema table
   * @param model Prisma model
   * @returns Schema table
   */
  #convertPrismaModelToSchemaTable(model: ModelDeclaration): TableDefinition {
    const fields = model.members.filter(({ kind }) => kind === 'field') as FieldDeclaration[]
    const blockAttributes = model.members.filter(({ kind }) => kind === 'blockAttribute') as BlockAttribute[]
    return {
      columns: this.#formatColumns(fields),
      primaryKey: this.#findPrimaryKeys(fields),
      foreignKeys: this.#findForeignKeys(fields),
      indexes: this.#findIndexes(blockAttributes),
      ignore: this.#isIgnored(model),
      map: this.#findMappedTableName(model),
    }
  }

  /**
   * Map referencial action to SQLite referencial action
   * @param action Prisma referencial action
   * @returns SQLite referencial action
   */
  #mapReferencialAction(action: string): string | undefined {
    switch (action) {
      case 'NoAction':
        return 'NO ACTION'
      case 'Cascade':
        return 'CASCADE'
      case 'SetNull':
        return 'SET NULL'
      case 'SetDefault':
        return 'SET DEFAULT'
      case 'Restrict':
        return 'RESTRICT'
    }
  }

  /**
   * Check if the name is a table name
   * @param name Potential table name
   * @returns `true` if the name is a table name, `false` otherwise
   */
  #isTableName(name: string): boolean {
    return this.#schema.declarations.some((declaration) => getDeclarationName(declaration) === `model ${name}`)
  }

  /**
   * Convert Prisma field to IR column
   * Ignore the field if it's a table name
   * @param field Prisma field
   * @returns Schema column or `undefined` if the field is a table name
   */
  #convertPrismaFieldToSchemaColumn(field: FieldDeclaration): ColumnDefinition | undefined {
    const type = getTypeValue(field.type)

    if (this.#isTableName(type)) {
      return undefined
    }

    const column: ColumnDefinition = {
      type,
      notNull: field.type.kind !== 'optional',
      primaryKey: field.attributes?.some((attr) => attr.path.value[0] === 'id'),
      unique: field.attributes?.some((attr) => attr.path.value[0] === 'unique'),
      default: getDefaultAttributeValue(findDefaultFieldAttribute(field)),
      map: findMapFieldAttribute(field)?.name,
    }

    return column
  }
}
