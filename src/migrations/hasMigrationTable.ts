import { db } from "../db";
import { logger } from "../logger";

/**
 * Returns a promise that resolves to a boolean indicating whether the migrations table exists
 * @returns Promise<boolean>
 */
export async function hasMigrationTable(): Promise<boolean> {
  return new Promise((resolve) => {
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'",
      (err, row) => {
        if (err) {
          logger.error(err);
          resolve(false);
        } else {
          resolve(row !== undefined);
        }
      }
    );
  });
}
