import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATION_LOCK_KEY = 7_204_311;

export async function runMigrations(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 1,
    onnotice: (notice) => {
      if (notice.severity === "INFO") console.info(notice.message);
    },
  });
  try {
    await client`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    await migrate(drizzle({ client }), { migrationsFolder: resolve("drizzle") });
  } finally {
    await client.end();
  }
}
