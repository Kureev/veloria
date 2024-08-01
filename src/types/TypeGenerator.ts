import { DatabaseSchema } from '../migrations/common/DatabaseSchema'
import { ColumnDefinition, Field } from '../migrations/types'
import { TypeObject } from './TypeObject'

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const utilityTypes = `
type WithOptional<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;
`

/**
 * Class to generate typescript definitions and react hooks for the schema
 */
export class TypeGenerator {
  constructor(private schema: DatabaseSchema) {}

  getCreateEntityName(name: string) {
    return `Create${this.getEntityName(name)}Input`
  }

  getEntityName(name: string) {
    return capitalize(name)
  }

  generate() {
    const tables = Object.entries(this.schema.getTables())
      .map(([name, table]) => {
        const typeName = this.getEntityName(name)
        return `export interface ${typeName} {\n${this.#generateFields(table.columns)}\n}`
      })
      .join('\n\n')

    const createEntityTypes = this.#generateCreateEntityTypes()

    return new TypeObject([utilityTypes, tables, createEntityTypes].join('\n\n'))
  }

  #generateFields(columns: Record<string, Field<ColumnDefinition>>) {
    return Object.values(columns)
      .map((column) => `  ${column.toInterface()}`)
      .join('\n')
  }

  #generateCreateEntityTypes() {
    return Object.entries(this.schema.getTables())
      .map(([name, table]) => {
        const typeName = this.getCreateEntityName(name)
        const omittable = this.#findOmittable<Field<ColumnDefinition>>(table.columns)
        return `export type ${typeName} = WithOptional<${this.getEntityName(name)}, ${omittable.join(' | ')}>`
      })
      .join('\n\n')
  }

  #findOmittable<T extends Field<ColumnDefinition>>(columns: Record<string, T>) {
    return Object.entries(columns)
      .filter(([, column]) => column.isOmittable())
      .map(([name, column]) => `'${column.get('map') ?? name}'`)
  }
}
