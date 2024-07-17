import { DefaultFieldAttribute, getExpressionValue } from '@loancrate/prisma-schema-parser'

function tryPrimitiveValue(value: unknown): string | undefined {
  switch (typeof value) {
    case 'string':
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
export function getDefaultAttributeValue(attribute: DefaultFieldAttribute | undefined): string | undefined {
  if (!attribute) return

  const value = getExpressionValue(attribute.expression)

  switch (value) {
    case 'autoincrement()':
      return 'AUTOINCREMENT'
    case 'now()':
      return `DEFAULT (strftime('%s', 'now'))`
    case 'cuid()':
      return `DEFAULT #CUID`
    case 'uuid()':
      return `DEFAULT #UUID`
    default:
      const primitive = tryPrimitiveValue(value)
      if (primitive) return primitive
  }
}
