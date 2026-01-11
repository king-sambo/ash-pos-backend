/**
 * PostgreSQL Database Connection Pool
 * Used for direct database queries when Supabase client is not suitable
 */

import { Pool } from "pg";
import { config } from "./env";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log connection errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

/**
 * Execute a query with automatic connection handling
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

/**
 * Execute a single-row query
 */
export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}
