import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

function createDb() {
  const client = postgres(env.DATABASE_URL, { max: 10 });
  return { client, db: drizzle({ client, schema }) };
}

let instance: ReturnType<typeof createDb> | undefined;

function connection() {
  instance ??= createDb();
  return instance;
}

export function db() {
  return connection().db;
}

export async function closeDb() {
  await instance?.client.end({ timeout: 5 });
  instance = undefined;
}
