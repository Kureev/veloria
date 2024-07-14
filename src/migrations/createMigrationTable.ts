import { db } from "../db";
import { logger } from "../logger";

export async function createMigrationTable(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
      (err) => {
        if (err) {
          logger.error(err);
          reject();
        }
        resolve();
      }
    );
  });
}
