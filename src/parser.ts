import { readFileSync } from "fs";
import { resolve, join } from "path";
import {
  type ModelDeclaration,
  parsePrismaSchema,
} from "@loancrate/prisma-schema-parser";
import { plural } from "pluralize";

const currentDir = resolve(__dirname);
const fixture = join(currentDir, "..", "__fixtures__", "schema.prisma");

const ast = parsePrismaSchema(readFileSync(fixture, { encoding: "utf8" }));

export function getModels(): ModelDeclaration[] {
  return ast.declarations.filter(
    ({ kind }) => kind === "model"
  ) as ModelDeclaration[];
}

export function getModelNames(): string[] {
  return getModels().map((model) => plural(model.name.value.toLowerCase()));
}
