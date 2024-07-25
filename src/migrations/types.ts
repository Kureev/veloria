export interface DatabaseSchema {
  tables: { [tableName: string]: TableDefinition }
}

export interface Field<T> {
  toSQL(): string
  toInterface(): string
  isOmittable(): boolean
  get(name: string): T[keyof T]
}

export interface TableDefinition {
  columns: { [columnName: string]: Field<ColumnDefinition> }
  primaryKeys: string[]
  foreignKeys?: ForeignKeyDefinition[]
  indexes?: IndexDefinition[]
  ignore?: boolean
  map?: string
}

export interface ColumnDefinition {
  type: string
  notNull: boolean
  primaryKey?: boolean
  unique?: boolean
  default?: string
  map?: string
}

export interface ForeignKeyDefinition {
  id?: number
  referencedTable: string
  references: string[]
  referencedColumns: string[]
  onUpdate?: ForeignKeyAction
  onDelete?: ForeignKeyAction
}

export type ForeignKeyAction = 'NoAction' | 'Cascade' | 'SetNull' | 'SetDefault' | 'Restrict'

export interface IndexDefinition {
  columns: string[]
  name?: string
  unique?: boolean
}
