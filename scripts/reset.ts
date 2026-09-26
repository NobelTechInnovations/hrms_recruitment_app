// Deletes the local SQLite database and uploaded files, then migrates and seeds.
import { rmSync } from "node:fs";
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "file:./data/hrms.db";
if (!url.startsWith("file:")) {
  console.error("db:reset only works with a local file database.");
  process.exit(1);
}
const file = url.replace(/^file:/, "");
for (const f of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`]) rmSync(f, { force: true });
rmSync(process.env.STORAGE_DIR ?? "./storage/uploads", { recursive: true, force: true });
console.log("✓ Removed local database and uploads");
execSync("npx tsx scripts/migrate.ts", { stdio: "inherit" });
execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });
