import { Database } from "sqlite3";
import { logger } from "./logger";

export const db = new Database("db.sqlite3");

export function close(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        logger.error(
          `Failed to close database connection with error: ${err.message}`
        );
        reject(err);
      } else {
        logger.info("Closed database connection");
        resolve();
      }
    });
  });
}
