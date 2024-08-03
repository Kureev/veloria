import { ColumnDefinition, Field } from '../types'

export class Column implements Field<ColumnDefinition> {
  #name: string
  #options: ColumnDefinition

  constructor(name: string, options: ColumnDefinition) {
    this.#name = name
    this.#options = options
  }

  get(name: keyof ColumnDefinition): ColumnDefinition[keyof ColumnDefinition] {
    return this.#options[name]
  }

  isOmittable() {
    return !!this.#options.default
  }

  toSQL() {
    let sql = `${this.#options.map || this.#name} ${this.#convertTypeToSQL(this.#options.type)}`
    if (this.#options.notNull) {
      sql += ' NOT NULL'
    }
    if (this.#options.unique) {
      sql += ' UNIQUE'
    }
    if (this.#options.primaryKey) {
      sql += ' PRIMARY KEY'
    }
    if (this.#options.default) {
      sql += ` ${this.#getDefaultAttributeValue(this.#options.default)}`
    }

    return sql
  }

  toInterface() {
    const name = this.#options.map ?? this.#name
    const optional = !this.#options.notNull ? '?' : ''
    const type = this.#convertTypeToInterface(this.#options.type)
    return `${name}${optional}: ${type}`
  }

  /**
   * Convert Prisma type to SQLite type
   * @param type Prisma type
   * @returns SQLite type
   * @example
   * convertType('String') => 'TEXT'
   * convertType('Int') => 'INTEGER'
   */
  #convertTypeToSQL(type: string): string {
    switch (type.toLocaleLowerCase()) {
      case 'string':
        return 'TEXT'
      case 'int':
      case 'boolean':
      case 'bigint':
        return 'INTEGER'
      case 'float':
        return 'REAL'
      case 'decimal':
        return 'DECIMAL'
      case 'datetime':
        return 'NUMERIC'
      case 'bytes':
        return 'BLOB'
      case 'json':
        throw new Error('JSON type is not supported')
      default:
        return type
    }
  }

  /**
   * Convert Prisma type to TypeScript interface type
   * @param type Prisma type
   * @returns TypeScript interface type
   */
  #convertTypeToInterface(type: string): string {
    switch (type.toLowerCase()) {
      case 'int':
        return 'number'
      case 'string':
        return 'string'
      case 'real':
      case 'datetime':
        return 'number'
      case 'blob':
        return 'Buffer'
      case 'boolean':
        return 'boolean'
      default:
        return 'any'
    }
  }

  #tryPrimitiveValue(value: unknown): string | undefined {
    switch (typeof value) {
      case 'string':
        if (value === 'AUTOINCREMENT') {
          return value
        }
        return `DEFAULT '${value}'`
      case 'number':
        return `DEFAULT ${value}`
      case 'boolean':
        return `DEFAULT ${value ? '1' : '0'}`
    }
  }

  /**
   * Convert @default value to SQLite default value
   * @param argument Schema argument
   * @returns String representation of the default value
   * @example
   * #getDefaultAttributeValue({ kind: 'literal', value: 'hello' }) => "DEFAULT 'hello'"
   * #getDefaultAttributeValue({ kind: 'literal', value: 42 }) => "DEFAULT 42"
   * #getDefaultAttributeValue({ kind: 'literal', value: true }) => "DEFAULT 1"
   */
  #getDefaultAttributeValue(value: string): string | undefined {
    if (!value) return

    switch (value) {
      case 'autoincrement()':
        return 'AUTOINCREMENT'
      case 'now()':
      case "strftime('%s', 'now')":
        return `DEFAULT (strftime('%s', 'now'))`
      case 'cuid()':
        return `DEFAULT #CUID`
      case 'uuid()':
        return `DEFAULT #UUID`
      default:
        const primitive = this.#tryPrimitiveValue(value)
        if (primitive) return primitive
    }
  }
}
