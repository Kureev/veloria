import { PrismaType } from '@loancrate/prisma-schema-parser'

/**
 * Get the value of a Prisma type
 * @param type Prisma type
 * @returns Value of the type
 */
export function getTypeValue(type: PrismaType): string {
  switch (type.kind) {
    case 'typeId':
      return type.name.value
    case 'optional':
    case 'list':
      return getTypeValue(type.type)
    case 'required':
      return getTypeValue(type.type)
    case 'unsupported':
      throw new Error(`Unsupported type: ${type.type.value}`)
  }
}
