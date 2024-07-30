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

import {
  type DatabaseSchema,
  type ForeignKeyDefinition,
  type IndexDefinition,
  type TableDefinition,
  ForeignKeyAction,
} from '../types'
import { Column } from '../common/Column'

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
          const schema = this.#convertPrismaModelToSchemaTable(model)
          if (schema.ignore) return acc

          acc[model.name.value] = schema
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
  #findForeignKeys(fields: FieldDeclaration[]): ForeignKeyDefinition[] {
    return fields.reduce((acc: ForeignKeyDefinition[], field: FieldDeclaration) => {
      const relation = field.attributes?.find((attr) => attr.path.value[0] === 'relation')
      if (!relation) return acc

      const namedArguments = relation.args!.filter((arg) => arg.kind === 'namedArgument')
      const args = getArgumentValuesObject(namedArguments)

      acc.push({
        referencedTable: getTypeValue(field.type) as string,
        references: args.fields as string[],
        referencedColumns: args.references as string[],
        onUpdate: args.onUpdate as ForeignKeyAction,
        onDelete: args.onDelete as ForeignKeyAction,
      })

      return acc
    }, [] as ForeignKeyDefinition[])
  }

  /**
   * Format columns to a map of column names to column definitions
   * @param fields Fields to format
   * @returns Map of column names to column definitions
   */
  #formatColumns(fields: FieldDeclaration[]): Record<string, Column> {
    return fields.reduce(
      (acc, field: FieldDeclaration) => {
        const column = this.#convertPrismaFieldToSchemaColumn(field)

        if (column) {
          acc[field.name.value] = column
        }

        return acc
      },
      {} as Record<string, Column>
    )
  }

  /**
   * Find indexes in the block attributes
   * @param blocks Block attributes to search for indexes
   * @returns List of indexes
   */
  #findIndexes(blocks: BlockAttribute[]): IndexDefinition[] {
    return blocks.reduce((acc, block: BlockAttribute) => {
      if (['index', 'unique'].find((value) => getExpressionValue(block.path) === value)) {
        const type = getExpressionValue(block.path)
        const args = getArgumentValues(block.args!) as [string[], string]
        acc.push({
          columns: args[0],
          name: args[1],
          unique: type === 'unique',
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
      return block.path.value[0] === 'ignore'
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
      primaryKeys: this.#findPrimaryKeys(fields),
      foreignKeys: this.#findForeignKeys(fields),
      indexes: this.#findIndexes(blockAttributes),
      ignore: this.#isIgnored(model),
      map: this.#findMappedTableName(model),
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
  #convertPrismaFieldToSchemaColumn(field: FieldDeclaration): Column | undefined {
    const type = getTypeValue(field.type)

    if (this.#isTableName(type)) {
      return undefined
    }

    let defaultValue: string | undefined
    const attrValue = findDefaultFieldAttribute(field)
    if (attrValue) {
      defaultValue = getExpressionValue(attrValue.expression) as string | undefined
    }

    const column = new Column(field.name.value, {
      type,
      notNull: field.type.kind !== 'optional',
      primaryKey: field.attributes?.some((attr) => attr.path.value[0] === 'id'),
      unique: field.attributes?.some((attr) => attr.path.value[0] === 'unique'),
      default: defaultValue,
      map: findMapFieldAttribute(field)?.name,
    })

    return column
  }
}
