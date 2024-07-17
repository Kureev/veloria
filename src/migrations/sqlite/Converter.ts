import { Database } from 'sqlite3'
import { AST, Create, Parser } from 'node-sql-parser/build/sqlite'
import { DatabaseSchema, TableDefinition } from '../types'

export class Converter {
  #db: Database
  #parser = new Parser()

  constructor(db: Database) {
    this.#db = db
  }

  async toSchema(): Promise<DatabaseSchema> {
    const tableAsts = await this.#getTables()
    const schema: DatabaseSchema = { tables: {} }

    const creationAST = tableAsts.filter((ast) => ast.type === 'create')
    const tableNames = creationAST.map((ast) => ast.table![0].table)

    const tableIndexes = await this.#getIndexes(tableNames)

    for (const { table, create_definitions } of creationAST) {
      const tableName = table![0].table
      schema.tables[tableName] = this.#convertTableInfoToTableDefinition(create_definitions, tableIndexes[tableName])!
    }

    return schema
  }

  async #getTables(): Promise<AST[]> {
    return new Promise((resolve, reject) => {
      this.#db.all<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations';",
        (err, rows) => {
          if (err) {
            reject(err)
          } else {
            resolve(rows.map((row) => this.#parser.astify(row.sql) as AST))
          }
        }
      )
    })
  }

  async #getIndexes(tableNames: string[]) {
    const queue: Promise<Record<string, unknown[]>>[] = tableNames.map(
      (tableName) =>
        new Promise((resolve, reject) => {
          this.#db.all<{ name: string }>(`PRAGMA index_list(${tableName})`, (err, indexes) => {
            if (err) {
              reject(err)
            } else {
              const indexInfoQueue = indexes.map((index) => this.#getIndexInfo(index))
              Promise.all(indexInfoQueue).then((indexInfo) => {
                resolve({ [tableName]: indexInfo })
              })
            }
          })
        })
    )

    const indexes = await Promise.all(queue)

    return indexes.reduce((acc, index) => {
      Object.entries(index).forEach(([tableName, indexes]) => {
        acc[tableName] = indexes
      })

      return acc
    }, {})
  }

  async #getIndexInfo(index: { name: string }): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      this.#db.all(`PRAGMA index_info(${index.name})`, (err, column) => {
        if (err) {
          reject(err)
        } else {
          resolve({ column, index })
        }
      })
    })
  }

  #convertTableInfoToTableDefinition(
    definitions: Create['create_definitions'],
    indexes: Record<string, unknown>[]
  ): TableDefinition | undefined {
    if (!definitions) {
      return { columns: {}, indexes: [], primaryKey: [], foreignKeys: {} }
    }

    const columns = definitions.filter((def) => def.resource === 'column')

    return {
      columns: columns.reduce(
        (acc, column) => {
          const name = column.column.column as string
          const type = column.definition.dataType
          const notNull = column.nullable?.type === 'not null'
          const primaryKey = (column as any).primary_key === 'primary key'
          const defaultValue = this.#formatDefaultValue(column.default_val)

          acc[name] = { type, notNull, primaryKey, default: defaultValue }
          return acc
        },
        {} as TableDefinition['columns']
      ),
      // TODO
      indexes: indexes.map((index) => {
        return {
          columns: index.column.map((col: any) => col.name),
          name: index.index.name,
          unique: Boolean(index.index.unique),
        }
      }),
      primaryKey: [],
      foreignKeys: {},
    }
  }

  #formatDefaultValue(value: unknown): string | undefined {
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
