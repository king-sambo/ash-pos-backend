/**
 * Database Reset Script
 * 
 * WARNING: This will delete all data!
 * For development use only.
 */

import { supabase } from "../config/supabase";

async function reset() {
  console.log("⚠️  WARNING: This will delete all data!");
  console.log("🔄 Resetting database...\n");

  try {
    // Tables to reset (in order due to foreign keys)
    const tables = [
      "discount_logs",
      "sale_items",
      "sales",
      "promotion_targets",
      "promotions",
      "customer_group_members",
      "customer_groups",
      "customers",
      "inventory_logs",
      "products",
      "categories",
      "users",
      "roles",
      "membership_tiers",
      "settings",
      "audit_logs",
    ];

    for (const table of tables) {
      console.log(`  Truncating ${table}...`);
      const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        console.log(`    Skipped (${error.message})`);
      } else {
        console.log(`    ✓ ${table} cleared`);
      }
    }

    console.log("\n✅ Database reset complete!");
    console.log("💡 Run 'npm run db:seed' to re-populate with initial data");

  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

reset();

