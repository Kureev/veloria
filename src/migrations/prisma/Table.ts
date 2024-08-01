import {
  BlockAttribute,
  FieldDeclaration,
  findDefaultFieldAttribute,
  findMapFieldAttribute,
  getArgumentValues,
  getArgumentValuesObject,
  getDeclarationName,
  getExpressionValue,
  ModelDeclaration,
  PrismaSchema,
} from '@loancrate/prisma-schema-parser'
import { ForeignKeyAction, ForeignKeyDefinition, IndexDefinition, TableDefinition } from '../types'
import { Column } from '../common/Column'
import { getTypeValue } from './getTypeValue'

export class Table implements TableDefinition {
  private fields: FieldDeclaration[]
  private blocks: BlockAttribute[]

  constructor(
    private model: ModelDeclaration,
    private schema: PrismaSchema
  ) {
    this.fields = model.members.filter(({ kind }) => kind === 'field') as FieldDeclaration[]
    this.blocks = model.members.filter(({ kind }) => kind === 'blockAttribute') as BlockAttribute[]
  }

  get columns() {
    return this.formatColumns()
  }

  get name() {
    return this.model.name.value
  }

  get primaryKeys() {
    return this.findPrimaryKeys()
  }

  get foreignKeys() {
    return this.findForeignKeys()
  }

  get indexes() {
    return this.findIndexes()
  }

  get map() {
    return this.findMappedTableName()
  }

  /**
   * Find the mapped table name in the block attributes
   * @param model Model to search for the mapped table name
   * @returns Mapped table name
   */
  private findMappedTableName(): string | undefined {
    const blocks = this.model.members.filter(({ kind }) => kind === 'blockAttribute') as BlockAttribute[]

    const block = blocks.find((block) => getExpressionValue(block.path) === 'map')

    if (block) {
      switch (block.args![0].kind) {
        case 'literal':
          return getExpressionValue(block.args![0]) as string
      }
    }
  }

  /**
   * Find primary keys in the fields
   * @param fields Fields to search for primary keys
   * @returns List of primary keys
   */
  private findPrimaryKeys(): string[] {
    return this.fields
      .filter((field) => field.attributes?.some((attr) => attr.path.value[0] === 'id'))
      .map((field) => field.name.value)
  }

  /**
   * Find foreign keys in the fields
   * @param fields Fields to search for foreign keys
   * @returns List of foreign keys
   */
  private findForeignKeys(): ForeignKeyDefinition[] {
    return this.fields.reduce((acc: ForeignKeyDefinition[], field: FieldDeclaration) => {
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
   * Find indexes in the block attributes
   * @param blocks Block attributes to search for indexes
   * @returns List of indexes
   */
  private findIndexes(): IndexDefinition[] {
    return this.blocks.reduce((acc, block: BlockAttribute) => {
      if (['index', 'unique'].find((value) => getExpressionValue(block.path) === value)) {
        const type = getExpressionValue(block.path)
        const args = getArgumentValues(block.args!) as [string[], string]

        const columns = args[0].map((column) => {
          const mapped = this.columns[column].get('map')
          if (mapped) {
            return mapped as string
          }
          return column
        })

        let name = args[1]

        if (!name) {
          name = `${this.map || this.name}_${columns.join('_')}_index`
        }

        acc.push({
          columns,
          name,
          unique: type === 'unique',
        })
      }
      return acc
    }, [] as IndexDefinition[])
  }

  /**
   * Format columns to a map of column names to column definitions
   * @param fields Fields to format
   * @returns Map of column names to column definitions
   */
  private formatColumns(): Record<string, Column> {
    return this.fields.reduce(
      (acc, field: FieldDeclaration) => {
        const column = this.convertPrismaFieldToSchemaColumn(field)

        if (column) {
          acc[field.name.value] = column
        }

        return acc
      },
      {} as Record<string, Column>
    )
  }

  /**
   * Check if the name is a table name
   * @param name Potential table name
   * @returns `true` if the name is a table name, `false` otherwise
   */
  private isTableName(name: string): boolean {
    return this.schema.declarations.some((declaration) => getDeclarationName(declaration) === `model ${name}`)
  }

  /**
   * Convert Prisma field to IR column
   * Ignore the field if it's a table name
   * @param field Prisma field
   * @returns Schema column or `undefined` if the field is a table name
   */
  private convertPrismaFieldToSchemaColumn(field: FieldDeclaration): Column | undefined {
    const type = getTypeValue(field.type)

    if (this.isTableName(type)) {
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
