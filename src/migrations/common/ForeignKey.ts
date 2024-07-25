import { ForeignKeyDefinition } from '../types'

export class ForeignKey {
  #options: ForeignKeyDefinition

  constructor(options: ForeignKeyDefinition) {
    this.#options = options
  }
}
