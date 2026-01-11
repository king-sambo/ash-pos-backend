/**
 * Database Seed Script
 *
 * Seeds the database with sample data for development and testing.
 * Run with: npx tsx src/database/seed.ts
 */

import { Pool } from "pg";
import * as bcrypt from "bcrypt";
import { config } from "dotenv";

config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function seed() {
  console.log("\n🌱 Starting database seeding...\n");

  const client = await pool.connect();

  try {
    // Start transaction
    await client.query("BEGIN");

    // ============================================
    // 1. Create Admin User
    // ============================================
    console.log("👤 Creating admin user...");

    const adminPasswordHash = await hashPassword("admin123");
    const supervisorPin = await hashPassword("1234");

    // Get super_admin role
    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = 'super_admin'"
    );
    const superAdminRoleId = roleResult.rows[0]?.id;

    if (!superAdminRoleId) {
      throw new Error("super_admin role not found. Run migrations first.");
    }

    // Check if admin already exists
    const existingAdmin = await client.query(
      "SELECT id FROM users WHERE email = 'admin@ashletrato.com'"
    );

    let adminId: string;

    if (existingAdmin.rows.length === 0) {
      const adminResult = await client.query(
        `INSERT INTO users (
          username, email, password_hash, supervisor_pin,
          first_name, last_name, phone, role_id,
          status, can_authorize_void, can_authorize_refund
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          "admin",
          "admin@ashletrato.com",
          adminPasswordHash,
          supervisorPin,
          "System",
          "Administrator",
          "09171234567",
          superAdminRoleId,
          "active",
          true,
          true,
        ]
      );
      adminId = adminResult.rows[0].id;
      console.log("  ✅ Admin user created");
    } else {
      adminId = existingAdmin.rows[0].id;
      console.log("  ⏭️  Admin user already exists");
    }

    // ============================================
    // 2. Create Sample Categories
    // ============================================
    console.log("\n📁 Creating categories...");

    const categories = [
      { name: "Beverages", slug: "beverages", description: "Drinks and refreshments" },
      { name: "Snacks", slug: "snacks", description: "Chips, crackers, and snack foods" },
      { name: "Dairy", slug: "dairy", description: "Milk, cheese, and dairy products" },
      { name: "Bread & Bakery", slug: "bread-bakery", description: "Bread, pastries, and baked goods" },
      { name: "Canned Goods", slug: "canned-goods", description: "Canned and preserved foods" },
      { name: "Condiments", slug: "condiments", description: "Sauces, spices, and seasonings" },
      { name: "Personal Care", slug: "personal-care", description: "Toiletries and personal hygiene" },
      { name: "Household", slug: "household", description: "Cleaning and household supplies" },
      { name: "Frozen Foods", slug: "frozen-foods", description: "Frozen meat and ready meals" },
      { name: "Rice & Grains", slug: "rice-grains", description: "Rice, pasta, and grains" },
    ];

    const categoryIds: Record<string, string> = {};

    for (const cat of categories) {
      const existing = await client.query(
        "SELECT id FROM categories WHERE slug = $1",
        [cat.slug]
      );

      if (existing.rows.length === 0) {
        const result = await client.query(
          `INSERT INTO categories (name, slug, description, is_active, sort_order)
           VALUES ($1, $2, $3, true, $4) RETURNING id`,
          [cat.name, cat.slug, cat.description, categories.indexOf(cat) + 1]
        );
        categoryIds[cat.slug] = result.rows[0].id;
      } else {
        categoryIds[cat.slug] = existing.rows[0].id;
      }
    }
    console.log(`  ✅ ${categories.length} categories ready`);

    // ============================================
    // 3. Create Sample Products
    // ============================================
    console.log("\n📦 Creating products...");

    const products = [
      // Beverages
      { name: "Coca-Cola 1.5L", category: "beverages", cost: 45, price: 65, stock: 100 },
      { name: "Pepsi 1.5L", category: "beverages", cost: 44, price: 63, stock: 80 },
      { name: "Sprite 1.5L", category: "beverages", cost: 45, price: 65, stock: 75 },
      { name: "Nestea Iced Tea 1L", category: "beverages", cost: 35, price: 48, stock: 60 },
      { name: "C2 Green Tea 500ml", category: "beverages", cost: 18, price: 25, stock: 120 },
      
      // Snacks
      { name: "Piattos Cheese 85g", category: "snacks", cost: 28, price: 38, stock: 50 },
      { name: "Nova Chips BBQ 78g", category: "snacks", cost: 25, price: 35, stock: 45 },
      { name: "Oishi Prawn Crackers 60g", category: "snacks", cost: 22, price: 30, stock: 60 },
      { name: "Chippy BBQ 110g", category: "snacks", cost: 30, price: 42, stock: 40 },
      { name: "Skyflakes Crackers 250g", category: "snacks", cost: 45, price: 62, stock: 35 },
      
      // Dairy
      { name: "Alaska Evap 370ml", category: "dairy", cost: 38, price: 52, stock: 80 },
      { name: "Bear Brand Milk 300g", category: "dairy", cost: 95, price: 125, stock: 45 },
      { name: "Nestle Cream 250ml", category: "dairy", cost: 42, price: 58, stock: 50 },
      { name: "Eden Cheese 165g", category: "dairy", cost: 55, price: 75, stock: 30 },
      { name: "Anchor Butter 227g", category: "dairy", cost: 180, price: 225, stock: 20 },
      
      // Bread & Bakery
      { name: "Gardenia White Bread", category: "bread-bakery", cost: 62, price: 82, stock: 25 },
      { name: "Pandesal (10pcs)", category: "bread-bakery", cost: 35, price: 50, stock: 40 },
      { name: "Ensaymada Pack", category: "bread-bakery", cost: 45, price: 65, stock: 20 },
      
      // Canned Goods
      { name: "Century Tuna Flakes 180g", category: "canned-goods", cost: 32, price: 45, stock: 100 },
      { name: "Argentina Corned Beef 260g", category: "canned-goods", cost: 65, price: 88, stock: 60 },
      { name: "555 Sardines 155g", category: "canned-goods", cost: 22, price: 32, stock: 80 },
      { name: "Spam Luncheon Meat 340g", category: "canned-goods", cost: 185, price: 235, stock: 25 },
      
      // Condiments
      { name: "UFC Banana Ketchup 320g", category: "condiments", cost: 28, price: 40, stock: 50 },
      { name: "Silver Swan Soy Sauce 1L", category: "condiments", cost: 55, price: 75, stock: 40 },
      { name: "Datu Puti Vinegar 1L", category: "condiments", cost: 35, price: 48, stock: 45 },
      { name: "Maggi Magic Sarap 50g", category: "condiments", cost: 18, price: 25, stock: 100 },
      
      // Personal Care
      { name: "Safeguard Soap 135g", category: "personal-care", cost: 38, price: 52, stock: 60 },
      { name: "Head & Shoulders 180ml", category: "personal-care", cost: 125, price: 165, stock: 30 },
      { name: "Colgate Toothpaste 150g", category: "personal-care", cost: 75, price: 98, stock: 40 },
      { name: "Rexona Deo Spray 150ml", category: "personal-care", cost: 145, price: 185, stock: 25 },
      
      // Household
      { name: "Joy Dishwashing 495ml", category: "household", cost: 65, price: 88, stock: 35 },
      { name: "Ariel Powder 1kg", category: "household", cost: 155, price: 198, stock: 25 },
      { name: "Domex Bleach 500ml", category: "household", cost: 55, price: 75, stock: 30 },
      
      // Rice & Grains
      { name: "Sinandomeng Rice 5kg", category: "rice-grains", cost: 280, price: 350, stock: 50 },
      { name: "Jasmine Rice 5kg", category: "rice-grains", cost: 320, price: 395, stock: 40 },
      { name: "Lucky Me Pancit Canton 60g", category: "rice-grains", cost: 12, price: 18, stock: 200 },
    ];

    let productsCreated = 0;
    for (const product of products) {
      const existing = await client.query(
        "SELECT id FROM products WHERE name = $1",
        [product.name]
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO products (
            name, category_id, cost_price, selling_price,
            current_stock, low_stock_threshold, status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            product.name,
            categoryIds[product.category],
            product.cost,
            product.price,
            product.stock,
            10,
            "active",
            adminId,
          ]
        );
        productsCreated++;
      }
    }
    console.log(`  ✅ ${productsCreated} products created (${products.length - productsCreated} already existed)`);

    // ============================================
    // 4. Create Sample Customers
    // ============================================
    console.log("\n👥 Creating sample customers...");

    // Get membership tier IDs
    const tierResult = await client.query("SELECT id, name FROM membership_tiers");
    const tiers: Record<string, string> = {};
    tierResult.rows.forEach((row) => {
      tiers[row.name] = row.id;
    });

    const customers = [
      {
        first_name: "Juan",
        last_name: "Dela Cruz",
        email: "juan.delacruz@email.com",
        phone: "09171111111",
        tier: "Regular",
        is_senior: false,
        is_pwd: false,
      },
      {
        first_name: "Maria",
        last_name: "Santos",
        email: "maria.santos@email.com",
        phone: "09172222222",
        tier: "Bronze",
        is_senior: false,
        is_pwd: false,
      },
      {
        first_name: "Pedro",
        last_name: "Reyes",
        email: "pedro.reyes@email.com",
        phone: "09173333333",
        tier: "Silver",
        is_senior: true,
        senior_id: "OSCA-2024-12345",
        is_pwd: false,
      },
      {
        first_name: "Ana",
        last_name: "Garcia",
        email: "ana.garcia@email.com",
        phone: "09174444444",
        tier: "Gold",
        is_senior: false,
        is_pwd: true,
        pwd_id: "PWD-2024-67890",
      },
      {
        first_name: "Jose",
        last_name: "Rizal",
        email: "jose.rizal@email.com",
        phone: "09175555555",
        tier: "Platinum",
        is_senior: false,
        is_pwd: false,
      },
      {
        first_name: "Andres",
        last_name: "Bonifacio",
        email: "andres.bonifacio@email.com",
        phone: "09176666666",
        tier: "VIP",
        is_senior: false,
        is_pwd: false,
      },
    ];

    let customersCreated = 0;
    for (const cust of customers) {
      const existing = await client.query(
        "SELECT id FROM customers WHERE email = $1",
        [cust.email]
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO customers (
            first_name, last_name, email, phone,
            membership_tier_id, is_senior_citizen, senior_citizen_id,
            is_pwd, pwd_id, id_verified, loyalty_points, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            cust.first_name,
            cust.last_name,
            cust.email,
            cust.phone,
            tiers[cust.tier],
            cust.is_senior,
            cust.is_senior ? (cust as any).senior_id : null,
            cust.is_pwd,
            cust.is_pwd ? (cust as any).pwd_id : null,
            cust.is_senior || cust.is_pwd,
            Math.floor(Math.random() * 500), // Random loyalty points
            adminId,
          ]
        );
        customersCreated++;
      }
    }
    console.log(`  ✅ ${customersCreated} customers created (${customers.length - customersCreated} already existed)`);

    // ============================================
    // 5. Update Store Settings
    // ============================================
    console.log("\n⚙️  Updating store settings...");

    await client.query(
      `UPDATE settings SET value = $1 WHERE key = 'store_name'`,
      ["ASH LETRATO INC"]
    );
    await client.query(
      `UPDATE settings SET value = $1 WHERE key = 'store_address_line1'`,
      ["123 Main Street"]
    );
    await client.query(
      `UPDATE settings SET value = $1 WHERE key = 'store_address_line2'`,
      ["Makati City, Metro Manila"]
    );
    await client.query(
      `UPDATE settings SET value = $1 WHERE key = 'store_phone'`,
      ["(02) 8888-7777"]
    );
    await client.query(
      `UPDATE settings SET value = $1 WHERE key = 'store_email'`,
      ["info@ashletrato.com"]
    );
    console.log("  ✅ Store settings updated");

    // Commit transaction
    await client.query("COMMIT");

    console.log("\n" + "=".repeat(50));
    console.log("🎉 Database seeding completed successfully!");
    console.log("=".repeat(50));
    console.log("\n📋 Summary:");
    console.log("   • Admin user: admin@ashletrato.com / admin123");
    console.log("   • Supervisor PIN: 1234");
    console.log(`   • Categories: ${categories.length}`);
    console.log(`   • Products: ${products.length}`);
    console.log(`   • Customers: ${customers.length}`);
    console.log("\n");
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("\n❌ Seeding failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeder
seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
