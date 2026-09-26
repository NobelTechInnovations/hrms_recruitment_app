import { mkdirSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";

async function main() {
  mkdirSync("data", { recursive: true });
  const { db } = await import("../src/db");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("✓ Database migrated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
