import { AST, Create, Parser } from 'node-sql-parser/build/sqlite'
import { DatabaseSchema, ForeignKeyAction, ForeignKeyDefinition, IndexDefinition, TableDefinition } from '../types'
import { BaseSQLite } from '../BaseSQLite'

type TableIndexInfo = {
  seqno: number
  cid: number
  name: string
}

type TableIndex = {
  seq: number
  name: string
  unique: number
  origin: string
  partial: number
}

type TableForeignKey = {
  id: number
  seq: number
  table: string
  from: string
  to: string
  on_update: string
  on_delete: string
  match: string
}

type TableIndexFormatted = Record<string, IndexDefinition[]>

export class Converter extends BaseSQLite {
  #parser = new Parser()

  async toSchema(): Promise<DatabaseSchema> {
    const tableAsts = await this.#getTables()
    const schema: DatabaseSchema = { tables: {} }

    const creationAST = tableAsts.filter((ast) => ast.type === 'create')
    const tableNames = creationAST.map((ast) => ast.table![0].table)

    const tableIndexes = await this.#getIndexes(tableNames)
    const foreignKeys = await this.#getForeignKeys(tableNames)

    for (const { table, create_definitions } of creationAST) {
      const tableName = table![0].table
      schema.tables[tableName] = this.#convertTableInfoToTableDefinition(
        create_definitions,
        tableIndexes[tableName],
        foreignKeys[tableName]
      )!
    }

    return schema
  }

  async #getTables(): Promise<AST[]> {
    const rows = await this.all<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations';"
    )
    return rows.map((row) => {
      const ast = this.#parser.astify(row.sql) as AST
      return ast
    })
  }

  async #getIndexes(tableNames: string[]): Promise<TableIndexFormatted> {
    const queue: Promise<TableIndexFormatted>[] = tableNames.map(async (tableName) => {
      const indexes = await this.all<TableIndex>(`PRAGMA index_list(${tableName})`)

      const indexInfoQueue = indexes.map((index) => this.#getIndexInfo(index))
      const indexInfos = await Promise.all(indexInfoQueue)

      return {
        [tableName]: indexInfos.flat(),
      }
    })

    const indexes = await Promise.all(queue)
    return indexes.reduce((acc, index) => ({ ...acc, ...index }), {})
  }

  async #getForeignKeys(tableNames: string[]): Promise<Record<string, ForeignKeyDefinition[]>> {
    const queue: Promise<Record<string, ForeignKeyDefinition>[] | null>[] = tableNames.map(async (tableName) => {
      const fk = await this.#getForeignKey(tableName)
      if (!fk.length) {
        return null
      }

      return fk.map((key) => ({
        [tableName]: {
          id: key.id,
          referencedTable: key.table,
          references: [key.from],
          referencedColumns: [key.to],
          onUpdate: key.on_update as ForeignKeyAction,
          onDelete: key.on_delete as ForeignKeyAction,
        },
      }))
    })

    const foreignKeys = await Promise.all(queue)
    const mergedForeignKeys: Record<string, ForeignKeyDefinition[]> = {}

    /**
     * PRAGMA foreign_key_list return multiple rows for a single foreign key if it references multiple columns.
     * Hence, we need to merge the foreign keys with identical id into one object.
     */
    for (const fk of foreignKeys) {
      if (!fk) {
        continue
      }

      for (const key of fk) {
        const tableName = Object.keys(key)[0]
        const foreignKey = Object.values(key)[0]

        if (!mergedForeignKeys[tableName]) {
          mergedForeignKeys[tableName] = [foreignKey]
          continue
        }

        const existingForeignKey = mergedForeignKeys[tableName].find((fk) => fk.id === foreignKey.id)
        if (existingForeignKey) {
          existingForeignKey.references.push(...foreignKey.references)
          existingForeignKey.referencedColumns.push(...foreignKey.referencedColumns)
        } else {
          mergedForeignKeys[tableName].push(foreignKey)
        }
      }
    }

    return mergedForeignKeys
  }

  async #getForeignKey(tableName: string): Promise<TableForeignKey[]> {
    return this.all<TableForeignKey>(`PRAGMA foreign_key_list(${tableName})`)
  }

  async #getIndexInfo({ name, unique }: TableIndex): Promise<IndexDefinition> {
    const info = await this.all<TableIndexInfo>(`PRAGMA index_info(${name})`)
    return {
      name,
      columns: info.map(({ name }) => name),
      unique: !!unique,
    }
  }

  #convertTableInfoToTableDefinition(
    definitions: Create['create_definitions'],
    indexes: IndexDefinition[],
    foreignKeys: ForeignKeyDefinition[]
  ): TableDefinition | undefined {
    if (!definitions) {
      return { columns: {}, indexes: [], primaryKeys: [], foreignKeys: [] }
    }

    const columns = definitions.filter((def) => def.resource === 'column')
    let primaryKeys: string[] = []

    return {
      columns: columns.reduce(
        (acc, column) => {
          const name = column.column.column as string
          const type = column.definition.dataType
          const unique = !!column.unique
          const notNull = column.nullable?.type === 'not null'
          const primaryKey = !!(column as any).primary_key
          const defaultValue = this.#formatDefaultValue(column.default_val, column.auto_increment)

          if (primaryKey) {
            primaryKeys.push(name)
          }

          acc[name] = { type, notNull, unique, primaryKey, default: defaultValue }
          return acc
        },
        {} as TableDefinition['columns']
      ),
      indexes,
      primaryKeys,
      foreignKeys,
      ignore: false,
      map: undefined,
    }
  }

  #formatDefaultValue(value: unknown, autoIncrement: string | undefined): string | undefined {
    if (autoIncrement) {
      return 'AUTOINCREMENT'
    }

    if (!value) {
      return undefined
    }

    switch ((value as any).value.type) {
      case 'single_quote_string':
      case 'number':
        return `DEFAULT '${(value as any).value.value}'`
      case 'function':
        return `DEFAULT (${(value as any).value.name.name[0].value}${this.#formatArgs((value as any).value.args)})`
      default:
        console.log((value as any).value.value)
    }
  }

  #formatArgs(args: any): string {
    switch (args.type) {
      case 'expr_list':
        return `(${args.value.map((arg: any) => `'${arg.value}'`).join(', ')})`
      default:
        return args.value
    }
  }
}
