import { db } from "../db";

type Table = {
  name: string;
};

/**
 * Fetch all tables in the database that are not system tables or the migration table
 * @returns Promise<unknown[]>
 */
export function fetchTableNames(): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    db.all<Table>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations';",
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map((row) => row.name));
        }
      }
    );
  });
}
