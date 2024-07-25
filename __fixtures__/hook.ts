import { type CreateUserInput } from '@veloria/client'
import { useSQLiteContext } from 'expo-sqlite'

export function useUser() {
  const db = useSQLiteContext()

  const create = async (data: CreateUserInput) => {
    const keys = Object.keys(data)
    const values = Object.values(data)
      .map((v) => `'${v}'`)
      .join(', ')
    return db.runAsync(`INSERT INTO User (${keys}) VALUES (${values})`)
  }

  const get = async (id: number) => {
    return db.getFirstAsync(`SELECT * FROM User WHERE id = ${id}`)
  }

  const list = async () => {
    return db.getAllAsync(`SELECT * FROM User`)
  }

  const update = async (id: number, data: CreateUserInput) => {
    const values = Object.entries(data)
      .map(([k, v]) => `${k} = '${v}'`)
      .join(', ')
    return db.runAsync(`UPDATE User SET ${values} WHERE id = ${id}`)
  }

  const remove = async (id: number) => {
    return db.runAsync(`DELETE FROM User WHERE id = ${id}`)
  }

  return { create, get, list, update, remove }
}
