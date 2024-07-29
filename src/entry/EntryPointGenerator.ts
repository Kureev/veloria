import fs from 'fs'
import path from 'path'
import { findProjectRoot } from '../utils'
import { HookObject } from '../hooks/HookObject'

const TYPES = "export * from './types'"

const root = findProjectRoot(process.cwd())
const templates = path.resolve(findProjectRoot(__dirname), 'templates')

function generateHookExports(hooks: HookObject[]) {
  return hooks.map((hook) => `export { ${hook.name} } from '@veloria/client/hooks/${hook.name}'`).join('\n')
}

function generateContextProvider(dbPath: string) {
  const dbName = dbPath.split('/').pop()
  if (!dbName) {
    throw new Error('Invalid db path')
  }
  const content = fs.readFileSync(path.resolve(templates, 'context.tsx')).toString('utf8')
  return content.replace(/\$DB_NAME/g, dbName).replace(/\$DB_PATH/g, dbPath)
}

export class EntryPointGenerator {
  static generate(dbPath: string, hooks: HookObject[]) {
    const entryPoint = [generateContextProvider(dbPath), TYPES, generateHookExports(hooks)].join('\n\n')

    const entryPointPath = path.resolve(root, 'node_modules', '@veloria', 'client', 'index.tsx')
    fs.writeFileSync(entryPointPath, entryPoint)
  }
}
