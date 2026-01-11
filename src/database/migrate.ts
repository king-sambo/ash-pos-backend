/**
 * Database Migration Script
 *
 * Runs SQL migration files against Supabase PostgreSQL database.
 * Migrations are executed in order based on filename prefix (001_, 002_, etc.)
 * 
 * Uses direct PostgreSQL connection via pg library.
 * Make sure DATABASE_URL has URL-encoded password if it contains special characters.
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  console.error("\n💡 Get your connection string from Supabase Dashboard:");
  console.error("   Project Settings → Database → Connection string → URI");
  console.error("\n⚠️  If your password has special characters, URL-encode them:");
  console.error("   @ → %40");
  console.error("   ! → %21");
  console.error("   # → %23");
  console.error("   $ → %24");
  process.exit(1);
}

// Parse and validate DATABASE_URL
function parseConnectionString(url: string): string {
  // Check if the URL might have encoding issues
  const atSymbols = (url.match(/@/g) || []).length;
  if (atSymbols > 1) {
    console.warn("\n⚠️  Warning: Multiple @ symbols detected in DATABASE_URL.");
    console.warn("   If your password contains @, it should be encoded as %40");
    console.warn("   Current URL structure may cause connection issues.\n");
  }
  return url;
}

const connectionString = parseConnectionString(DATABASE_URL);

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 10000,
});

interface Migration {
  name: string;
  path: string;
}

async function getMigrationFiles(): Promise<Migration[]> {
  const migrationsDir = path.join(__dirname, "migrations");

  if (!fs.existsSync(migrationsDir)) {
    console.error("❌ Migrations directory not found:", migrationsDir);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  return files.map((file) => ({
    name: file,
    path: path.join(migrationsDir, file),
  }));
}

async function createMigrationsTable(client: any): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getExecutedMigrations(client: any): Promise<string[]> {
  const result = await client.query("SELECT name FROM _migrations ORDER BY id");
  return result.rows.map((row: any) => row.name);
}

async function runMigration(
  client: any,
  migration: Migration
): Promise<boolean> {
  const sql = fs.readFileSync(migration.path, "utf-8");

  try {
    console.log(`  📄 Running: ${migration.name}`);

    // Execute the migration
    await client.query(sql);

    // Record the migration
    await client.query("INSERT INTO _migrations (name) VALUES ($1)", [
      migration.name,
    ]);

    console.log(`  ✅ Completed: ${migration.name}`);
    return true;
  } catch (error: any) {
    console.error(`  ❌ Failed: ${migration.name}`);
    console.error(`     Error: ${error.message}`);

    // Show more context for debugging
    if (error.position) {
      const lines = sql.split("\n");
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1;
        if (charCount >= parseInt(error.position)) {
          console.error(`     Near line ${i + 1}: ${lines[i].trim()}`);
          break;
        }
      }
    }

    return false;
  }
}

async function runMigrations(): Promise<void> {
  console.log("\n🔄 Starting database migrations...\n");

  let client;
  try {
    console.log("🔌 Connecting to database...");
    client = await pool.connect();
    console.log("✅ Connected!\n");
  } catch (error: any) {
    console.error("❌ Failed to connect to database:", error.message);
    console.error("\n💡 Troubleshooting tips:");
    console.error("   1. Check if DATABASE_URL is correct in your .env file");
    console.error("   2. Make sure special characters in password are URL-encoded");
    console.error("   3. Verify your Supabase project is running");
    console.error("   4. Check if your IP is allowed (if IP restrictions are enabled)");
    console.error("\n📋 Get connection string from: Supabase Dashboard → Settings → Database");
    process.exit(1);
  }

  try {
    // Create migrations tracking table
    await createMigrationsTable(client);

    // Get all migration files
    const migrations = await getMigrationFiles();
    console.log(`📁 Found ${migrations.length} migration files\n`);

    // Get already executed migrations
    const executed = await getExecutedMigrations(client);
    console.log(`📋 ${executed.length} migrations already executed\n`);

    // Filter pending migrations
    const pending = migrations.filter((m) => !executed.includes(m.name));

    if (pending.length === 0) {
      console.log("✨ No pending migrations. Database is up to date!\n");
      return;
    }

    console.log(`🔧 Running ${pending.length} pending migrations...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const migration of pending) {
      const success = await runMigration(client, migration);
      if (success) {
        successCount++;
      } else {
        failCount++;
        // Stop on first failure
        console.log("\n⚠️  Stopping migrations due to error.\n");
        break;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`✅ Successful: ${successCount}`);
    if (failCount > 0) {
      console.log(`❌ Failed: ${failCount}`);
    }
    console.log("=".repeat(50) + "\n");

    if (failCount > 0) {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function showStatus(): Promise<void> {
  console.log("\n📊 Migration Status\n");

  let client;
  try {
    client = await pool.connect();
  } catch (error: any) {
    console.error("❌ Failed to connect:", error.message);
    process.exit(1);
  }

  try {
    await createMigrationsTable(client);

    const migrations = await getMigrationFiles();
    const executed = await getExecutedMigrations(client);

    console.log("Migration".padEnd(50) + "Status");
    console.log("-".repeat(60));

    for (const migration of migrations) {
      const status = executed.includes(migration.name) ? "✅ Done" : "⏳ Pending";
      console.log(migration.name.padEnd(50) + status);
    }

    console.log("-".repeat(60));
    console.log(
      `Total: ${migrations.length} | Executed: ${executed.length} | Pending: ${migrations.length - executed.length}\n`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

async function resetMigrations(): Promise<void> {
  console.log("\n⚠️  Resetting migration tracking table...\n");

  let client;
  try {
    client = await pool.connect();
  } catch (error: any) {
    console.error("❌ Failed to connect:", error.message);
    process.exit(1);
  }

  try {
    await client.query("DROP TABLE IF EXISTS _migrations CASCADE");
    console.log("✅ Migration tracking table reset.\n");
    console.log("💡 Run migrations again with: npx tsx src/database/migrate.ts\n");
  } finally {
    client.release();
    await pool.end();
  }
}

// CLI handling
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "status":
    showStatus();
    break;
  case "reset":
    resetMigrations();
    break;
  case "help":
    console.log(`
Database Migration Tool

Usage:
  npx tsx src/database/migrate.ts [command]

Commands:
  (none)    Run pending migrations
  status    Show migration status
  reset     Reset migration tracking (does not drop tables)
  help      Show this help message

Environment:
  DATABASE_URL    PostgreSQL connection string (required)
                  Get from: Supabase Dashboard → Settings → Database → URI

Note: If your password has special characters, URL-encode them:
  @ → %40    ! → %21    # → %23    $ → %24
    `);
    break;
  default:
    runMigrations();
}
