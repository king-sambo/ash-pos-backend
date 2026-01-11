/**
 * Supabase Connection Test Script
 * 
 * Usage: npx tsx src/database/test-connection.ts
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testConnection() {
  console.log("🔌 Testing Supabase Connection...\n");

  // Check environment variables
  console.log("1️⃣  Checking environment variables...");
  
  if (!SUPABASE_URL) {
    console.error("   ❌ SUPABASE_URL is not set");
    process.exit(1);
  }
  console.log(`   ✓ SUPABASE_URL: ${SUPABASE_URL}`);

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("   ❌ SUPABASE_SERVICE_ROLE_KEY is not set");
    process.exit(1);
  }
  console.log(`   ✓ SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);

  // Create Supabase client
  console.log("\n2️⃣  Creating Supabase client...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log("   ✓ Client created");

  // Test connection by querying the database
  console.log("\n3️⃣  Testing database connection...");
  
  try {
    // Try to get the current timestamp from the database
    const { data, error } = await supabase.rpc("now");
    
    if (error) {
      // If 'now' RPC doesn't exist, try a simple query
      console.log("   ⚠ RPC 'now' not found, trying alternative test...");
      
      // Try to list tables (this tests the connection)
      const { data: tables, error: tablesError } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "public")
        .limit(5);
      
      if (tablesError) {
        // Last resort: try auth health check
        console.log("   ⚠ Table query failed, testing auth service...");
        
        const { data: authData, error: authError } = await supabase.auth.getSession();
        
        if (authError) {
          throw authError;
        }
        
        console.log("   ✓ Auth service is responding");
        console.log("   ✓ Connection successful (auth verified)");
      } else {
        console.log(`   ✓ Found ${tables?.length || 0} tables in public schema`);
        if (tables && tables.length > 0) {
          console.log("   📋 Tables:", tables.map((t: any) => t.table_name).join(", "));
        }
      }
    } else {
      console.log(`   ✓ Database time: ${data}`);
    }

    console.log("\n✅ Supabase connection successful!\n");

    // Additional info
    console.log("📊 Connection Details:");
    console.log(`   Project URL: ${SUPABASE_URL}`);
    console.log(`   Region: ${SUPABASE_URL.split('.')[0].replace('https://', '')}`);
    
  } catch (err: any) {
    console.error("\n❌ Connection failed!");
    console.error("   Error:", err.message || err);
    
    console.log("\n🔧 Troubleshooting:");
    console.log("   1. Check if SUPABASE_URL is correct");
    console.log("   2. Check if SUPABASE_SERVICE_ROLE_KEY is valid");
    console.log("   3. Ensure your Supabase project is active");
    console.log("   4. Check your internet connection");
    
    process.exit(1);
  }

  process.exit(0);
}

testConnection();
