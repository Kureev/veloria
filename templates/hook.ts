// @ts-ignore This file is used to generate hooks for the schema

import { type Create$MODEL_NAMEInput, type $MODEL_NAME } from '@veloria/client'
import { useSQLiteContext } from 'expo-sqlite'

const FIELD_MAPPING: Record<keyof $MODEL_NAME, string> = $FIELD_MAPPING

export function use$MODEL_NAME() {
  const db = useSQLiteContext()

  async function create(data: Create$MODEL_NAMEInput) {
    const keys = Object.keys(data)
      .map((k) => FIELD_MAPPING[k as keyof Create$MODEL_NAMEInput])
      .join(', ')
    const values = Object.values(data)
      .map((v) => `'${v}'`)
      .join(', ')
    return db.runAsync(`INSERT INTO $MAPPED_MODEL_NAME (${keys}) VALUES (${values})`)
  }

  async function get(id: number) {
    return db.getFirstAsync<$MODEL_NAME>(`SELECT * FROM $MAPPED_MODEL_NAME WHERE id = ${id}`)
  }

  async function list() {
    return db.getAllAsync<$MODEL_NAME>(`SELECT * FROM $MAPPED_MODEL_NAME`)
  }

  async function update(id: number, data: Create$MODEL_NAMEInput) {
    const values = Object.entries(data)
      .map(([k, v]) => `${FIELD_MAPPING[k as keyof Create$MODEL_NAMEInput]} = '${v}'`)
      .join(', ')
    return db.runAsync(`UPDATE $MAPPED_MODEL_NAME SET ${values} WHERE id = ${id}`)
  }

  async function remove(id: number) {
    return db.runAsync(`DELETE FROM $MAPPED_MODEL_NAME WHERE id = ${id}`)
  }

  return { create, get, list, update, remove }
}
