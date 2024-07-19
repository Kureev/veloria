import { AST, Create, Parser } from 'node-sql-parser/build/sqlite'
import { DatabaseSchema, IndexDefinition, TableDefinition } from '../types'
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
      schema.tables[tableName] = this.#convertTableInfoToTableDefinition(create_definitions, tableIndexes[tableName])!
    }

    return schema
  }

  async #getTables(): Promise<AST[]> {
    const rows = await this.all<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations';"
    )
    return rows.map((row) => this.#parser.astify(row.sql) as AST)
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

  async #getForeignKeys(tableNames: string[]): Promise<Record<string, Record<string, string>>> {
    const queue: Promise<Record<string, Record<string, string>>>[] = tableNames.map((tableName) =>
      this.#getForeignKey(tableName).then((foreignKeys) => ({ [tableName]: foreignKeys }))
    )

    const foreignKeys = await Promise.all(queue)
    return foreignKeys.reduce((acc, foreignKey) => ({ ...acc, ...foreignKey }), {})
  }

  async #getForeignKey(tableName: string): Promise<Record<string, string>> {
    const rows = await this.all<any>(`PRAGMA foreign_key_list(${tableName})`)
    return rows.reduce(
      (acc, row) => {
        acc[row.from] = row.table
        return acc
      },
      {} as Record<string, string>
    )
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
    indexes: IndexDefinition[]
  ): TableDefinition | undefined {
    if (!definitions) {
      return { columns: {}, indexes: [], primaryKey: [], foreignKeys: [] }
    }

    const columns = definitions.filter((def) => def.resource === 'column')

    return {
      columns: columns.reduce(
        (acc, column) => {
          const name = column.column.column as string
          const type = column.definition.dataType
          const notNull = column.nullable?.type === 'not null'
          const primaryKey = (column as any).primary_key === 'primary key'
          const defaultValue = this.#formatDefaultValue(column.default_val, column.auto_increment)

          acc[name] = { type, notNull, primaryKey, default: defaultValue }
          return acc
        },
        {} as TableDefinition['columns']
      ),
      // TODO
      indexes,
      primaryKey: [],
      foreignKeys: [],
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
