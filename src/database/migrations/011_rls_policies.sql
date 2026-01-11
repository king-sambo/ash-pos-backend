-- Migration: 011_rls_policies.sql
-- Description: Enable Row Level Security policies
-- Created: 2026-01-08
-- Note: These are basic RLS policies. For a POS system accessed primarily through
-- backend APIs with service role, RLS may be optional. Enable as needed.

-- Enable RLS on tables (but don't create restrictive policies for backend access)
-- The backend uses service_role key which bypasses RLS

-- For now, we'll just enable RLS without restrictive policies
-- This allows the service_role to have full access while
-- preparing for future anon/authenticated access if needed

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
-- Note: service_role bypasses RLS, so these are for documentation

-- Public settings policy (for anon users to read store info)
CREATE POLICY "Public settings are viewable by everyone"
ON settings FOR SELECT
USING (is_public = TRUE);

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid()::text = id::text);

-- Allow all operations for authenticated users with proper role checks done in API
-- For POS, most operations go through the backend with service_role
CREATE POLICY "Authenticated users can read products"
ON products FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can read customers"
ON customers FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

-- Sales visible to the user who created them or managers
CREATE POLICY "Users can view their sales"
ON sales FOR SELECT
TO authenticated
USING (
    user_id::text = auth.uid()::text 
    OR EXISTS (
        SELECT 1 FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id::text = auth.uid()::text 
        AND r.name IN ('super_admin', 'manager')
    )
);

-- Note: For a POS system, most operations will use the backend's service_role key
-- which bypasses RLS. These policies are for direct Supabase client access if needed.

-- Grant usage on sequences (if any)
-- Most tables use gen_random_uuid() which doesn't need sequence grants

-- Create a view for active products
CREATE OR REPLACE VIEW active_products AS
SELECT * FROM products WHERE status = 'active' AND deleted_at IS NULL;

-- Create a view for active customers
CREATE OR REPLACE VIEW active_customers AS
SELECT * FROM customers WHERE is_active = TRUE AND deleted_at IS NULL;

-- Create a view for today's sales
CREATE OR REPLACE VIEW today_sales AS
SELECT * FROM sales 
WHERE DATE(created_at) = CURRENT_DATE 
AND status = 'completed';

-- Create a view for low stock products
CREATE OR REPLACE VIEW low_stock_products AS
SELECT * FROM products 
WHERE track_inventory = TRUE 
AND current_stock <= low_stock_threshold
AND status = 'active'
AND deleted_at IS NULL;
