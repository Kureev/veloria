import fs from 'fs'
import { dirname } from 'path'

export class HookObject {
  constructor(
    public name: string,
    private value: string
  ) {}

  save(path: string) {
    fs.mkdirSync(dirname(path), { recursive: true })
    fs.writeFileSync(path, this.value)
  }

  toString() {
    return this.value
  }
}
