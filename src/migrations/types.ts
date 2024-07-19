export interface DatabaseSchema {
  tables: { [tableName: string]: TableDefinition }
}

export interface TableDefinition {
  columns: { [columnName: string]: ColumnDefinition }
  primaryKey: string[]
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
