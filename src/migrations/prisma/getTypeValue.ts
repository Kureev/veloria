import { PrismaType } from '@loancrate/prisma-schema-parser'

/**
 * Convert Prisma type to SQLite type
 * @param type Prisma type
 * @returns SQLite type
 * @example
 * convertType('String') => 'TEXT'
 * convertType('Int') => 'INTEGER'
 */
function convertType(type: string): string {
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
      return type
  }
}

/**
 * Get the value of a Prisma type
 * @param type Prisma type
 * @returns Value of the type
 */
export function getTypeValue(type: PrismaType): string {
  switch (type.kind) {
    case 'typeId':
      return convertType(type.name.value)
    case 'optional':
    case 'list':
      return getTypeValue(type.type)
    case 'required':
      return getTypeValue(type.type)
    case 'unsupported':
      throw new Error(`Unsupported type: ${type.type.value}`)
  }
}
