import { plural, singular } from 'pluralize'
import { Database } from '../db'
import { logger } from '../logger'
import { Parser } from '../parser'
import {
  BlockAttribute,
  FieldAttribute,
  FieldDeclaration,
  SchemaArgument,
  TypeId,
} from '@loancrate/prisma-schema-parser'

type Table = {
  name: string
}

const REF = '#REF'

export class Migrator {
  #db: Database
  #parser: Parser

  constructor(db: Database, parser: Parser) {
    this.#db = db
    this.#parser = parser
  }

  /**
   * Migrate the database to match the schema
   * @returns Promise<void>
   */
  async migrate(): Promise<void> {
    await this.#setupMigrationTable()

    const schemaModelNames = this.#parser.getModelNames()
    const existingTableNames = await this.#fetchTableNames()

    const newModels = schemaModelNames.filter((model) => !existingTableNames.includes(this.#convertToTableName(model)))
    const deletedModels = existingTableNames.filter(
      (table) => !schemaModelNames.includes(this.#convertToModelName(table))
    )

    newModels.forEach((model) => {
      logger.info(`Creating table for model ${model}`)
      this.#createTable(model, this.#parser.getModelFields(model), this.#parser.getModelBlockAttributes(model))
    })
  }

  /**
   * Initialize the database by creating the migration table if it does not exist
   */
  async #setupMigrationTable(): Promise<void> {
    let migrationTable: boolean

    try {
      migrationTable = await this.#hasMigrationTable()
    } catch (err) {
      logger.error(`Failed to check if migration table exists ${err.message}`)
    }

    if (migrationTable === false) {
      logger.info('Creating migration table...')
      try {
        await this.#createMigrationTable()
      } catch (err) {
        logger.error(`Failed to set up migration table ${err.message}`)
      }
      logger.info('Migration table created')
    }

    logger.info('Database initialized')
  }

  /**
   * Table names are plural and lowercase. Model names are singular and capitalized.
   * Function converts model names to table names.
   * @param model Model name
   * @returns Table name
   */
  #convertToTableName(model: string): string {
    return plural(model).toLowerCase()
  }

  /**
   * Table names are plural and lowercase. Model names are singular and capitalized.
   * Function converts table names to model names.
   * @param table Table name
   * @returns Model name
   */
  #convertToModelName(table: string): string {
    const singularName = singular(table)
    return singularName.charAt(0).toUpperCase() + singularName.slice(1)
  }

  /**
   * Returns a promise that resolves to a boolean indicating whether the migrations table exists
   * @returns Promise<boolean>
   */
  async #hasMigrationTable(): Promise<boolean> {
    return new Promise((resolve) => {
      this.#db.instance.get("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'", (err, row) => {
        if (err) {
          logger.error(err)
          resolve(false)
        } else {
          resolve(row !== undefined)
        }
      })
    })
  }

  /**
   * Create the migration table in the database
   * @returns Promise<void>
   */
  async #createMigrationTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#db.instance.run(
        `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
        (err) => {
          if (err) {
            logger.error(err)
            reject()
          }
          resolve()
        }
      )
    })
  }

  /**
   * Fetch all tables in the database excluding system tables and the `migration` table
   * @returns Promise<string[]>
   */
  #fetchTableNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.#db.instance.all<Table>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations';",
        (err, rows) => {
          if (err) {
            reject(err)
          } else {
            resolve(rows.map((row) => row.name))
          }
        }
      )
    })
  }

  /**
   * Create a table in the database
   * @param model Model name
   * @param schema Model schema
   */
  #createTable(model: string, fields: FieldDeclaration[], blockAttributes: BlockAttribute[]): void {
    const tableName = this.#convertToTableName(model)
    const columns = fields
      .map((field) => this.#convertFieldToColumn(field))
      .filter((x) => x)
      .sort((a, b) => a.order - b.order)
      .map((c) => c.column)
    const attributes = blockAttributes.map((attribute) => this.#convertBlockAttributeToColumn(attribute))

    const payload = columns.concat(attributes)

    console.log(`CREATE TABLE ${tableName} (${payload.join(', ')})`)

    // this.#db.instance.run(`CREATE TABLE ${tableName} (${columns})`, (err) => {
    //   if (err) {
    //     logger.error(`Failed to create table for model ${model} with error: ${err.message}`)
    //   } else {
    //     logger.info(`Table for model ${model} created`)
    //   }
    // })
  }

  /**
   * Convert a field declaration to a column definition
   * @param field Field declaration
   * @returns string
   */
  #convertFieldToColumn(field: FieldDeclaration): { order: number; column: string } {
    const name = field.name.value

    let type: string
    let attributes: string[] = []
    let relations: string[] = []

    switch (field.type.kind) {
      case 'typeId':
        type = this.#convertType(field.type.name.value)
        type = `${type} NOT NULL`
        attributes = this.#convertAttributes(field.attributes)
        relations = this.#convertRelations(field.attributes, name)
        if (relations.length) {
          return { order: 1, column: `${relations.join(' ')}` }
        }
        if (type === REF) {
          return
        }
        break
      case 'optional':
        type = this.#convertType((field.type.type as TypeId).name.value)
        attributes = this.#convertAttributes(field.attributes)
        relations = this.#convertRelations(field.attributes, name)
        if (relations.length) {
          return { order: 1, column: `${relations.join(' ')}` }
        }
        if (type === REF) {
          return
        }
        break
      case 'list':
        if (field.type.type.kind === 'unsupported') {
          logger.error(`Unsupported field type: ${name} of type "${field.type.kind}" which is not supported`)
          return
        } else {
          type = this.#convertType((field.type.type as TypeId).name.value)
          if (type === REF) {
            return
          }
        }
        break
      case 'unsupported':
        logger.error(`Unsupported field type: ${name} of type "${field.type.kind}" which is not supported`)
      default:
        logger.error(`Unknown field type ${field.type.kind}`)
        break
    }
    return { order: 0, column: `${name} ${type} ${attributes.join(' ')}` }
  }

  /**
   * Convert block attributes to column attributes
   * @param attribute Block attribute
   * @returns string
   */
  #convertBlockAttributeToColumn(attribute: BlockAttribute): string {
    const name = attribute.path.value[0]
    const args = attribute.args[0]
    if (name === 'id') {
      return `PRIMARY KEY ${this.#getDefaultAttributeValue(args)}`
    }
    return ''
  }

  /**
   * Convert field attributes to column attributes
   * @param attributes Field attributes
   * @param type Column type
   * @returns string[]
   * @example
   * #convertAttributes([{ path: { kind: 'path', value: ['id'] }, args: [] }]) => ['PRIMARY KEY']
   * #convertAttributes([{ path: { kind: 'path', value: ['unique'] }, args: [] }]) => ['UNIQUE']
   * #convertAttributes([{ path: { kind: 'path', value: ['default'] }, args: [{ kind: 'literal', value: 'hello' }] }]) => ["DEFAULT 'hello'"]
   */
  #convertAttributes(attributes: FieldAttribute[]): string[] {
    return attributes
      .map((attribute) => {
        switch (attribute.path.value[0]) {
          case 'id':
            return 'PRIMARY KEY'
          case 'unique':
            return 'UNIQUE'
          case 'default':
            return `${this.#getDefaultAttributeValue(attribute.args![0])}`
          default:
            return
        }
      })
      .filter((x) => x)
  }

  /**
   * Convert relation attributes to foreign key constraints
   * @param attributes Field attributes
   * @param refName Referenced model name
   * @returns string[]
   */
  #convertRelations(attributes: FieldAttribute[], refName: string): string[] {
    return attributes
      .filter((attribute) => attribute.path.value[0] === 'relation')
      .map((attribute) => {
        const args = attribute.args.filter((arg) => arg.kind === 'namedArgument')
        const fields = this.#getDefaultAttributeValue(args.find((arg) => arg.name.value === 'fields').expression)
        const references = this.#getDefaultAttributeValue(
          args.find((arg) => arg.name.value === 'references').expression
        )
        const hasOnDelete = args.find((arg) => arg.name.value === 'onDelete')
        const hasOnUpdate = args.find((arg) => arg.name.value === 'onUpdate')

        const onDelete = this.#getDefaultAttributeValue(args.find((arg) => arg.name.value === 'onDelete'))
        const onUpdate = this.#getDefaultAttributeValue(args.find((arg) => arg.name.value === 'onUpdate'))
        // TODO
        const name = args.find((arg) => arg.name.value === 'name')
        const map = args.find((arg) => arg.name.value === 'map')

        let ref = `FOREIGN KEY ${fields} REFERENCES ${this.#convertToTableName(refName)}${references}`
        if (hasOnDelete) {
          ref += ` ON DELETE ${onDelete}`
        }
        if (hasOnUpdate) {
          ref += ` ON UPDATE ${onUpdate}`
        }
        return ref
      })
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
  #getDefaultAttributeValue(argument: SchemaArgument): string {
    switch (argument.kind) {
      case 'functionCall':
        const func = argument.path.value[0]
        if (func === 'autoincrement') {
          return 'AUTOINCREMENT'
        } else if (func === 'now') {
          return `DEFAULT (strftime('%s', 'now'))`
        } else {
          // cuid() and uuid() are not supported on the SQLite side,
          // so we will implement them on the application side
          return ''
        }
      case 'path':
        if (argument.value[0] === 'NoAction') return 'NO ACTION'
        return argument.value[0].toUpperCase()
      case 'namedArgument':
        return this.#getDefaultAttributeValue(argument.expression).toUpperCase()
      case 'array':
        return `(${argument.items.map((item) => (item.kind === 'path' ? item.value : '')).join(', ')})`
      case 'literal':
        if (typeof argument.value === 'string') {
          return `DEFAULT '${argument.value}'`
        } else if (typeof argument.value === 'number') {
          return `DEFAULT ${argument.value}`
        } else if (typeof argument.value === 'boolean') {
          return `DEFAULT ${argument.value ? 1 : 0}`
        }
    }
  }

  /**
   * Convert Prisma type to SQLite type
   * @param type Prisma type
   * @returns SQLite type
   * @${exampl} NOT NULLe
   `* #convertType('String') => 'TEXT'`
   * #convertType('Int') => 'INTEGER'
   */
  #convertType(type: string): string {
    switch (type) {
      case 'String':
        return 'TEXT'
      case 'Int':
        return 'INTEGER'
      case 'Boolean':
        return 'INTEGER'
      case 'BigInt':
        return 'INTEGER'
      case 'Float':
        return 'REAL'
      case 'Decimal':
        return 'DECIMAL'
      case 'DateTime':
        return 'NUMERIC'
      case 'Bytes':
        return 'BLOB'
      case 'Json':
        throw new Error('JSON type is not supported')
      default:
        const isModel = this.#parser.getModelNames().includes(type)
        if (isModel) {
          return REF
        } else {
          throw new Error(`Unknown type ${type}`)
        }
    }
  }
}
