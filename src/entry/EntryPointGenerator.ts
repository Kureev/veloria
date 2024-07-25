import fs from 'fs'
import path from 'path'

export class EntryPointGenerator {
  static generate() {
    const entryPoint = `export * from './schema'`
    const entryPointPath = path.resolve(__dirname, '..', '..', 'node_modules', '@veloria/client', 'index.ts')
    fs.writeFileSync(entryPointPath, entryPoint)
  }
}
