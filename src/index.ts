import { close } from "./db";
import { logger } from "./logger";
import { createMigrationTable } from "./migrations/createMigrationTable";
import { fetchTableNames } from "./migrations/fetchTableNames";
import { hasMigrationTable } from "./migrations/hasMigrationTable";
import { getModelNames, getModels } from "./parser";
import { plural } from "pluralize";

/**
 * Sets up the database by creating the migration table if it does not exist
 */
async function setup() {
  let migrationTable: boolean;

  try {
    migrationTable = await hasMigrationTable();
  } catch (err) {
    logger.error(`Failed to check if migration table exists ${err.message}`);
  }

  if (migrationTable === false) {
    logger.info("Creating migration table...");
    try {
      await createMigrationTable();
    } catch (err) {
      logger.error(`Failed to set up migration table ${err.message}`);
    }
    logger.info("Migration table created");
  } else {
    logger.info("Migration table already exists");
  }
}

async function main() {
  await setup();
  const currentTableNames = await fetchTableNames();
  const schemaTableNames = getModelNames();
  console.log(currentTableNames, schemaTableNames);
  await close();
}

main();
