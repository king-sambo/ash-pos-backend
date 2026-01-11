-- Migration: 001_extensions_and_functions.sql
-- Description: Enable extensions and create utility functions
-- Created: 2026-01-08

-- Enable UUID extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to generate customer code (CUST-XXXXXX)
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := 'CUST-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        SELECT EXISTS(SELECT 1 FROM customers WHERE customer_code = new_code) INTO code_exists;
        EXIT WHEN NOT code_exists;
    END LOOP;
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to generate membership ID (MEM-XXXXXX)
CREATE OR REPLACE FUNCTION generate_membership_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    id_exists BOOLEAN;
BEGIN
    LOOP
        new_id := 'MEM-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        SELECT EXISTS(SELECT 1 FROM customers WHERE membership_id = new_id) INTO id_exists;
        EXIT WHEN NOT id_exists;
    END LOOP;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate invoice number (INV-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    today_prefix TEXT;
    seq_num INT;
    new_invoice TEXT;
BEGIN
    today_prefix := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-';
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 14) AS INT)), 0) + 1
    INTO seq_num
    FROM sales
    WHERE invoice_number LIKE today_prefix || '%';
    
    new_invoice := today_prefix || LPAD(seq_num::TEXT, 4, '0');
    RETURN new_invoice;
END;
$$ LANGUAGE plpgsql;

-- Function to generate product SKU
CREATE OR REPLACE FUNCTION generate_product_sku()
RETURNS TEXT AS $$
DECLARE
    new_sku TEXT;
    sku_exists BOOLEAN;
BEGIN
    LOOP
        new_sku := 'SKU-' || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
        SELECT EXISTS(SELECT 1 FROM products WHERE sku = new_sku) INTO sku_exists;
        EXIT WHEN NOT sku_exists;
    END LOOP;
    RETURN new_sku;
END;
$$ LANGUAGE plpgsql;
-- Migration: 002_roles_and_permissions.sql
-- Description: Create roles and permissions tables
-- Created: 2026-01-08

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    module VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permission junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

-- Trigger for updated_at
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles
INSERT INTO roles (name, description, is_system) VALUES
    ('super_admin', 'System administrator with full access', TRUE),
    ('manager', 'Store manager with operational control', TRUE),
    ('cashier', 'Point of sale operator', TRUE),
    ('inventory_clerk', 'Stock management staff', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, description, module) VALUES
    -- Dashboard
    ('dashboard.view', 'View dashboard', 'dashboard'),
    ('dashboard.view_all', 'View all dashboard metrics', 'dashboard'),
    
    -- Users
    ('users.view', 'View users', 'users'),
    ('users.create', 'Create users', 'users'),
    ('users.edit', 'Edit users', 'users'),
    ('users.delete', 'Delete users', 'users'),
    ('users.manage_roles', 'Manage user roles', 'users'),
    
    -- Customers
    ('customers.view', 'View customers', 'customers'),
    ('customers.create', 'Create customers', 'customers'),
    ('customers.edit', 'Edit customers', 'customers'),
    ('customers.delete', 'Delete customers', 'customers'),
    ('customers.manage_membership', 'Manage membership tiers', 'customers'),
    ('customers.issue_card', 'Issue membership cards', 'customers'),
    
    -- Products
    ('products.view', 'View products', 'products'),
    ('products.create', 'Create products', 'products'),
    ('products.edit', 'Edit products', 'products'),
    ('products.delete', 'Delete products', 'products'),
    ('products.manage_categories', 'Manage categories', 'products'),
    ('products.adjust_stock', 'Adjust stock levels', 'products'),
    
    -- Sales
    ('sales.create', 'Create sales', 'sales'),
    ('sales.view', 'View sales', 'sales'),
    ('sales.view_all', 'View all sales', 'sales'),
    ('sales.void', 'Void transactions', 'sales'),
    ('sales.refund', 'Process refunds', 'sales'),
    ('sales.authorize_void', 'Authorize void transactions', 'sales'),
    ('sales.authorize_refund', 'Authorize refunds', 'sales'),
    ('sales.apply_discount', 'Apply discounts', 'sales'),
    ('sales.apply_manual_discount', 'Apply manual discounts', 'sales'),
    
    -- Promotions
    ('promotions.view', 'View promotions', 'promotions'),
    ('promotions.create', 'Create promotions', 'promotions'),
    ('promotions.edit', 'Edit promotions', 'promotions'),
    ('promotions.delete', 'Delete promotions', 'promotions'),
    
    -- Discounts
    ('discounts.view', 'View discount settings', 'discounts'),
    ('discounts.manage', 'Manage discount settings', 'discounts'),
    ('discounts.apply_govt', 'Apply government discounts', 'discounts'),
    
    -- Reports
    ('reports.view', 'View basic reports', 'reports'),
    ('reports.view_all', 'View all reports', 'reports'),
    ('reports.export', 'Export reports', 'reports'),
    
    -- Settings
    ('settings.view', 'View settings', 'settings'),
    ('settings.manage', 'Manage settings', 'settings'),
    ('settings.manage_loyalty', 'Manage loyalty settings', 'settings')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager'
AND p.name NOT IN ('settings.manage', 'users.delete', 'users.manage_roles')
ON CONFLICT DO NOTHING;

-- Cashier permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'cashier'
AND p.name IN (
    'dashboard.view',
    'customers.view', 'customers.create', 'customers.edit',
    'products.view',
    'sales.create', 'sales.view', 'sales.apply_discount',
    'discounts.apply_govt',
    'reports.view'
)
ON CONFLICT DO NOTHING;

-- Inventory Clerk permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'inventory_clerk'
AND p.name IN (
    'dashboard.view',
    'products.view', 'products.create', 'products.edit', 'products.manage_categories', 'products.adjust_stock',
    'reports.view'
)
ON CONFLICT DO NOTHING;
-- Migration: 003_users.sql
-- Description: Create users table
-- Created: 2026-01-08

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    supervisor_pin VARCHAR(255),              -- Hashed PIN for void/refund authorization
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    role_id UUID NOT NULL REFERENCES roles(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    can_authorize_void BOOLEAN DEFAULT FALSE,
    can_authorize_refund BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    password_changed_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
-- Migration: 004_membership_tiers.sql
-- Description: Create membership tiers table
-- Created: 2026-01-08

CREATE TABLE IF NOT EXISTS membership_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    min_spend DECIMAL(15,2) DEFAULT 0,
    max_spend DECIMAL(15,2),
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    points_multiplier DECIMAL(3,2) DEFAULT 1.0,
    benefits JSONB,
    color VARCHAR(7),                         -- Hex color for UI display
    icon VARCHAR(50),                         -- Icon name for UI
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for updated_at
CREATE TRIGGER update_membership_tiers_updated_at
    BEFORE UPDATE ON membership_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default membership tiers
INSERT INTO membership_tiers (name, description, min_spend, max_spend, discount_percentage, points_multiplier, color, sort_order) VALUES
    ('Regular', 'Standard customer', 0, 4999.99, 0, 1.0, '#6B7280', 1),
    ('Bronze', 'Bronze member', 5000, 14999.99, 3, 1.1, '#CD7F32', 2),
    ('Silver', 'Silver member', 15000, 49999.99, 5, 1.25, '#C0C0C0', 3),
    ('Gold', 'Gold member', 50000, 99999.99, 8, 1.5, '#FFD700', 4),
    ('Platinum', 'Platinum member', 100000, 249999.99, 10, 1.75, '#E5E4E2', 5),
    ('VIP', 'VIP/Corporate member', 250000, NULL, 15, 2.0, '#8B5CF6', 6)
ON CONFLICT (name) DO NOTHING;
-- Migration: 005_customer_groups.sql
-- Description: Create customer groups table
-- Created: 2026-01-08

CREATE TABLE IF NOT EXISTS customer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_predefined BOOLEAN DEFAULT FALSE,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from DATE,
    valid_until DATE,
    auto_assign_rules JSONB,                  -- Rules for auto-assignment
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for updated_at
CREATE TRIGGER update_customer_groups_updated_at
    BEFORE UPDATE ON customer_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert predefined customer groups
INSERT INTO customer_groups (name, description, is_predefined, discount_percentage) VALUES
    ('Senior Citizens', 'Customers aged 60 and above', TRUE, 20),
    ('PWD', 'Persons with Disability', TRUE, 20),
    ('Solo Parents', 'Solo parent cardholders', TRUE, 10),
    ('Students', 'Student discount group', TRUE, 5),
    ('Teachers', 'Teachers and educators', TRUE, 5),
    ('Healthcare Workers', 'Medical professionals', TRUE, 5),
    ('Government Employees', 'Government workers', TRUE, 5),
    ('Military/Police', 'Armed forces and police', TRUE, 5),
    ('OFW', 'Overseas Filipino Workers', TRUE, 5),
    ('Barangay Officials', 'Local barangay officials', TRUE, 5),
    ('LGBT', 'LGBT community members', TRUE, 0),
    ('National Athletes', 'National athletes with Medal of Valor', TRUE, 20)
ON CONFLICT (name) DO NOTHING;
-- Migration: 006_customers.sql
-- Description: Create customers table
-- Created: 2026-01-08

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(20) UNIQUE NOT NULL DEFAULT generate_customer_code(),
    membership_id VARCHAR(20) UNIQUE,
    membership_barcode VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(10),
    birthdate DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    
    -- Membership
    membership_tier_id UUID REFERENCES membership_tiers(id),
    membership_issued_at TIMESTAMP,
    membership_expires_at DATE,
    membership_card_issued BOOLEAN DEFAULT FALSE,
    membership_renewed_at TIMESTAMP,
    
    -- Government IDs
    is_senior_citizen BOOLEAN DEFAULT FALSE,
    senior_citizen_id VARCHAR(50),
    is_pwd BOOLEAN DEFAULT FALSE,
    pwd_id VARCHAR(50),
    is_solo_parent BOOLEAN DEFAULT FALSE,
    solo_parent_id VARCHAR(50),
    id_verified BOOLEAN DEFAULT FALSE,
    id_verified_at TIMESTAMP,
    id_verified_by UUID REFERENCES users(id),
    id_expiry_date DATE,
    
    -- Loyalty
    loyalty_points INT DEFAULT 0,
    lifetime_spend DECIMAL(15,2) DEFAULT 0,
    total_transactions INT DEFAULT 0,
    last_transaction_at TIMESTAMP,
    
    -- Other
    notes TEXT,
    tags JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_membership_id ON customers(membership_id);
CREATE INDEX IF NOT EXISTS idx_customers_membership_barcode ON customers(membership_barcode) WHERE membership_barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(membership_tier_id);
CREATE INDEX IF NOT EXISTS idx_customers_senior ON customers(is_senior_citizen) WHERE is_senior_citizen = TRUE;
CREATE INDEX IF NOT EXISTS idx_customers_pwd ON customers(is_pwd) WHERE is_pwd = TRUE;

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Customer-Group junction table
CREATE TABLE IF NOT EXISTS customer_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATE,
    added_by UUID REFERENCES users(id),
    UNIQUE(customer_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_group_members_customer ON customer_group_members(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_group_members_group ON customer_group_members(group_id);

-- Loyalty points history
CREATE TABLE IF NOT EXISTS loyalty_points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'adjust', 'bonus')),
    points INT NOT NULL,
    balance_after INT NOT NULL,
    reference_type VARCHAR(50),               -- 'sale', 'refund', 'manual', etc.
    reference_id UUID,                        -- Related sale_id, etc.
    description TEXT,
    expires_at DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_history_customer ON loyalty_points_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_history_type ON loyalty_points_history(transaction_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_history_date ON loyalty_points_history(created_at);
-- Migration: 007_categories_and_products.sql
-- Description: Create categories and products tables
-- Created: 2026-01-08

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    image_url TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_product_sku(),
    barcode VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Pricing
    cost_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(15,2) NOT NULL,
    compare_at_price DECIMAL(15,2),           -- Original price for showing discounts
    
    -- Tax
    is_taxable BOOLEAN DEFAULT TRUE,
    tax_rate DECIMAL(5,2) DEFAULT 12,         -- VAT rate
    is_vat_exempt_eligible BOOLEAN DEFAULT TRUE,  -- Can be VAT exempt for SC/PWD
    
    -- Inventory
    track_inventory BOOLEAN DEFAULT TRUE,
    current_stock INT DEFAULT 0,
    low_stock_threshold INT DEFAULT 10,
    allow_backorder BOOLEAN DEFAULT FALSE,
    
    -- Unit
    unit VARCHAR(20) DEFAULT 'piece',
    unit_value DECIMAL(10,2) DEFAULT 1,
    
    -- Images
    image_url TEXT,
    images JSONB,                             -- Array of image URLs
    
    -- Discounts
    is_discountable BOOLEAN DEFAULT TRUE,
    exclude_from_promotions BOOLEAN DEFAULT FALSE,
    exclude_from_membership_discount BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
    
    -- Metadata
    tags JSONB,
    attributes JSONB,                         -- Custom attributes like color, size
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(current_stock) WHERE track_inventory = TRUE;

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Product variants table (for products with size, color, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    attributes JSONB NOT NULL,                -- { "size": "L", "color": "Red" }
    cost_price DECIMAL(15,2),
    selling_price DECIMAL(15,2),
    current_stock INT DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Stock movements table
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'return', 'damage', 'transfer', 'count')),
    quantity INT NOT NULL,                    -- Positive for in, negative for out
    quantity_before INT NOT NULL,
    quantity_after INT NOT NULL,
    reference_type VARCHAR(50),               -- 'sale', 'purchase_order', 'manual', etc.
    reference_id UUID,
    unit_cost DECIMAL(15,2),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- Product bundles table
CREATE TABLE IF NOT EXISTS product_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bundle_product_id, component_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_bundles_bundle ON product_bundles(bundle_product_id);
-- Migration: 008_promotions.sql
-- Description: Create promotions and discounts tables
-- Created: 2026-01-08

-- Promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code VARCHAR(50) UNIQUE,                  -- Coupon code (optional)
    
    -- Type and value
    promotion_type VARCHAR(30) NOT NULL CHECK (promotion_type IN (
        'percentage', 'fixed_amount', 'buy_x_get_y', 'bundle', 'flash_sale',
        'member_exclusive', 'individual_exclusive', 'group_exclusive', 'affinity'
    )),
    discount_value DECIMAL(15,2) NOT NULL,    -- Percentage or fixed amount
    
    -- Buy X Get Y specific
    buy_quantity INT,
    get_quantity INT,
    get_product_id UUID REFERENCES products(id),
    
    -- Conditions
    min_purchase_amount DECIMAL(15,2),
    max_discount_amount DECIMAL(15,2),
    min_quantity INT,
    
    -- Limits
    usage_limit INT,                          -- Total usage limit
    usage_limit_per_customer INT,
    current_usage INT DEFAULT 0,
    
    -- Targeting
    target_type VARCHAR(30) DEFAULT 'all' CHECK (target_type IN ('all', 'products', 'categories', 'customers', 'groups')),
    target_products JSONB,                    -- Array of product IDs
    target_categories JSONB,                  -- Array of category IDs
    target_customers JSONB,                   -- Array of customer IDs
    target_groups JSONB,                      -- Array of group IDs
    target_membership_tiers JSONB,            -- Array of tier IDs
    
    -- Schedule
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    active_days JSONB,                        -- Array of days [0-6] for recurring
    active_hours JSONB,                       -- { start: "09:00", end: "17:00" }
    
    -- Stacking
    is_stackable BOOLEAN DEFAULT FALSE,
    priority INT DEFAULT 0,                   -- Higher priority applied first
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_type ON promotions(promotion_type);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active) WHERE is_active = TRUE;

CREATE TRIGGER update_promotions_updated_at
    BEFORE UPDATE ON promotions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Promotion usage tracking
CREATE TABLE IF NOT EXISTS promotion_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    sale_id UUID,                             -- Will be linked after sales table exists
    discount_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_customer ON promotion_usage(customer_id);

-- Discount settings table
CREATE TABLE IF NOT EXISTS discount_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_type VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    percentage DECIMAL(5,2) NOT NULL,
    is_vat_exempt BOOLEAN DEFAULT FALSE,
    requires_id BOOLEAN DEFAULT FALSE,
    id_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_discount_settings_updated_at
    BEFORE UPDATE ON discount_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default government discount settings
INSERT INTO discount_settings (discount_type, name, description, percentage, is_vat_exempt, requires_id, id_type) VALUES
    ('senior_citizen', 'Senior Citizen Discount', 'RA 9994 - 20% discount for 60+ years old', 20, TRUE, TRUE, 'OSCA ID'),
    ('pwd', 'PWD Discount', 'RA 10754 - 20% discount for persons with disability', 20, TRUE, TRUE, 'PWD ID'),
    ('solo_parent', 'Solo Parent Discount', 'Solo Parent Welfare Act - 10% discount', 10, FALSE, TRUE, 'Solo Parent ID'),
    ('national_athlete', 'National Athlete Discount', 'Medal of Valor recipients - 20% discount', 20, TRUE, TRUE, 'NSA ID'),
    ('employee', 'Employee Discount', 'Staff discount', 10, FALSE, FALSE, NULL)
ON CONFLICT (discount_type) DO NOTHING;

-- Discount reasons for manual discounts
CREATE TABLE IF NOT EXISTS discount_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    requires_approval BOOLEAN DEFAULT FALSE,
    max_percentage DECIMAL(5,2),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO discount_reasons (code, name, requires_approval, max_percentage, sort_order) VALUES
    ('damaged_goods', 'Damaged Goods', FALSE, 50, 1),
    ('customer_complaint', 'Customer Complaint Resolution', TRUE, 30, 2),
    ('price_match', 'Price Match', TRUE, 20, 3),
    ('bulk_purchase', 'Bulk Purchase Discount', FALSE, 15, 4),
    ('loyalty_reward', 'Loyalty Reward', FALSE, 10, 5),
    ('promotional', 'Promotional Discount', FALSE, 20, 6),
    ('goodwill', 'Goodwill Gesture', TRUE, 25, 7),
    ('partner_affiliate', 'Partner/Affiliate Discount', TRUE, 15, 8),
    ('other', 'Other (Specify)', TRUE, 50, 99)
ON CONFLICT (code) DO NOTHING;
-- Migration: 009_sales.sql
-- Description: Create sales and related tables
-- Created: 2026-01-08

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(30) UNIQUE NOT NULL DEFAULT generate_invoice_number(),
    
    -- Customer
    customer_id UUID REFERENCES customers(id),
    
    -- Cashier
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Amounts
    subtotal DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    
    -- Payment
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'gcash', 'maya', 'split')),
    payment_details JSONB,                    -- For split payments or card details
    amount_tendered DECIMAL(15,2),
    change_amount DECIMAL(15,2),
    
    -- Discount info
    discount_type VARCHAR(50),                -- 'senior_citizen', 'pwd', 'membership', 'promotion', 'manual'
    discount_breakdown JSONB,                 -- Detailed breakdown of discounts
    
    -- VAT
    is_vat_exempt BOOLEAN DEFAULT FALSE,
    vat_exempt_reason VARCHAR(50),            -- 'senior_citizen', 'pwd'
    vatable_amount DECIMAL(15,2) DEFAULT 0,
    vat_amount DECIMAL(15,2) DEFAULT 0,
    vat_exempt_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'voided', 'refunded', 'partial_refund', 'held')),
    
    -- Void info
    voided_at TIMESTAMP,
    voided_by UUID REFERENCES users(id),
    void_authorized_by UUID REFERENCES users(id),
    void_reason TEXT,
    
    -- Refund info
    refunded_at TIMESTAMP,
    refunded_by UUID REFERENCES users(id),
    refund_authorized_by UUID REFERENCES users(id),
    refund_reason TEXT,
    refund_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Loyalty points
    points_earned INT DEFAULT 0,
    points_redeemed INT DEFAULT 0,
    points_value_redeemed DECIMAL(15,2) DEFAULT 0,
    
    -- Other
    notes TEXT,
    held_at TIMESTAMP,
    held_name VARCHAR(100),                   -- Name for held transaction
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_held ON sales(status) WHERE status = 'held';

CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sale items table
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    
    -- Product info (denormalized for historical accuracy)
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    
    -- Quantities and pricing
    quantity INT NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    cost_price DECIMAL(15,2),
    
    -- Discounts
    discount_amount DECIMAL(15,2) DEFAULT 0,
    discount_type VARCHAR(50),
    discount_percentage DECIMAL(5,2),
    
    -- Tax
    is_vat_exempt BOOLEAN DEFAULT FALSE,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Totals
    subtotal DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    
    -- Refund tracking
    quantity_refunded INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- Sale payments table (for split payments)
CREATE TABLE IF NOT EXISTS sale_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'gcash', 'maya', 'bank_transfer', 'credit')),
    amount DECIMAL(15,2) NOT NULL,
    reference_number VARCHAR(100),            -- Card auth code, GCash ref, etc.
    payment_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);

-- Sale discounts table (for tracking multiple discounts per sale)
CREATE TABLE IF NOT EXISTS sale_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    discount_type VARCHAR(50) NOT NULL,       -- 'senior_citizen', 'pwd', 'membership', 'promotion', 'manual'
    discount_name VARCHAR(100),
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(15,2) NOT NULL,
    reference_id UUID,                        -- promotion_id, customer_id, etc.
    approved_by UUID REFERENCES users(id),    -- For manual discounts
    reason VARCHAR(100),                      -- For manual discounts
    is_government_mandated BOOLEAN DEFAULT FALSE,
    customer_id_number VARCHAR(50),           -- SC/PWD ID for BIR
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_discounts_sale ON sale_discounts(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_discounts_type ON sale_discounts(discount_type);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id),
    refund_number VARCHAR(30) UNIQUE NOT NULL,
    
    -- Who processed
    processed_by UUID NOT NULL REFERENCES users(id),
    authorized_by UUID NOT NULL REFERENCES users(id),
    
    -- Amounts
    total_amount DECIMAL(15,2) NOT NULL,
    refund_method VARCHAR(20) NOT NULL CHECK (refund_method IN ('cash', 'card', 'gcash', 'maya', 'store_credit')),
    
    reason TEXT NOT NULL,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refunds_sale ON refunds(sale_id);

-- Refund items table
CREATE TABLE IF NOT EXISTS refund_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES sale_items(id),
    quantity INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_items_refund ON refund_items(refund_id);

-- Add foreign key for promotion_usage.sale_id now that sales table exists
ALTER TABLE promotion_usage 
ADD CONSTRAINT fk_promotion_usage_sale 
FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promotion_usage_sale ON promotion_usage(sale_id);
-- Migration: 010_settings_and_audit.sql
-- Description: Create settings and audit tables
-- Created: 2026-01-08

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
    category VARCHAR(50) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,          -- Can be accessed without auth
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO settings (key, value, type, category, description) VALUES
    -- Store info
    ('store_name', 'ASH LETRATO INC', 'string', 'store', 'Store name'),
    ('store_address_line1', '', 'string', 'store', 'Address line 1'),
    ('store_address_line2', '', 'string', 'store', 'Address line 2'),
    ('store_phone', '', 'string', 'store', 'Store phone number'),
    ('store_email', '', 'string', 'store', 'Store email'),
    ('store_tin', '', 'string', 'store', 'Tax Identification Number'),
    ('store_logo_url', '', 'string', 'store', 'Store logo URL'),
    
    -- Tax settings
    ('tax_rate', '12', 'number', 'tax', 'Default VAT rate'),
    ('tax_inclusive', 'true', 'boolean', 'tax', 'Prices are tax inclusive'),
    
    -- Discount settings
    ('max_discount_cashier', '5', 'number', 'discount', 'Max discount % for cashiers'),
    ('max_discount_manager', '20', 'number', 'discount', 'Max discount % for managers'),
    ('require_discount_reason', 'true', 'boolean', 'discount', 'Require reason for manual discounts'),
    
    -- Void/Refund Authorization
    ('void_requires_supervisor', 'true', 'boolean', 'authorization', 'Require supervisor PIN for void'),
    ('refund_requires_supervisor', 'true', 'boolean', 'authorization', 'Require supervisor PIN for refund'),
    ('void_time_limit_minutes', '30', 'number', 'authorization', 'Minutes after sale when void is allowed without approval'),
    
    -- Loyalty points
    ('loyalty_enable', 'true', 'boolean', 'loyalty', 'Enable loyalty points system'),
    ('loyalty_peso_threshold', '100', 'number', 'loyalty', 'Peso amount needed to earn points'),
    ('loyalty_points_per_threshold', '1', 'number', 'loyalty', 'Points earned per threshold'),
    ('loyalty_redemption_value', '1', 'number', 'loyalty', 'Peso value per redeemed point'),
    ('loyalty_min_redemption', '100', 'number', 'loyalty', 'Minimum points to redeem'),
    ('loyalty_max_redemption_percent', '50', 'number', 'loyalty', 'Max % of total that can be paid with points'),
    ('loyalty_expiry_days', '365', 'number', 'loyalty', 'Days until points expire (0 = never)'),
    ('loyalty_earn_on_discounted', 'true', 'boolean', 'loyalty', 'Earn points on discounted items'),
    ('loyalty_earn_on_sc_pwd', 'false', 'boolean', 'loyalty', 'Earn points on SC/PWD transactions'),
    
    -- Membership
    ('membership_default_validity_days', '365', 'number', 'membership', 'Default membership validity in days'),
    ('membership_renewal_reminder_days', '30', 'number', 'membership', 'Days before expiry to send reminder'),
    
    -- Inventory
    ('low_stock_threshold_default', '10', 'number', 'inventory', 'Default low stock threshold'),
    ('allow_negative_stock', 'false', 'boolean', 'inventory', 'Allow selling with negative stock'),
    
    -- Receipt
    ('receipt_header', '', 'string', 'receipt', 'Custom receipt header text'),
    ('receipt_footer', 'Thank you for shopping with us!', 'string', 'receipt', 'Receipt footer text'),
    ('receipt_show_cashier', 'true', 'boolean', 'receipt', 'Show cashier name on receipt'),
    
    -- Security
    ('session_timeout_minutes', '30', 'number', 'security', 'Session timeout in minutes'),
    ('max_login_attempts', '5', 'number', 'security', 'Max failed login attempts before lockout'),
    ('lockout_duration_minutes', '15', 'number', 'security', 'Account lockout duration'),
    ('password_min_length', '8', 'number', 'security', 'Minimum password length')
ON CONFLICT (key) DO NOTHING;

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,         -- 'user', 'product', 'sale', etc.
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_at);

-- Cash drawer sessions
CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Opening
    opening_amount DECIMAL(15,2) NOT NULL,
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Closing
    expected_amount DECIMAL(15,2),
    actual_amount DECIMAL(15,2),
    difference DECIMAL(15,2),
    closed_at TIMESTAMP,
    closed_by UUID REFERENCES users(id),
    
    -- Totals
    total_cash_sales DECIMAL(15,2) DEFAULT 0,
    total_card_sales DECIMAL(15,2) DEFAULT 0,
    total_gcash_sales DECIMAL(15,2) DEFAULT 0,
    total_maya_sales DECIMAL(15,2) DEFAULT 0,
    total_refunds DECIMAL(15,2) DEFAULT 0,
    
    notes TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_user ON cash_drawer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_status ON cash_drawer_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_date ON cash_drawer_sessions(opened_at);

CREATE TRIGGER update_cash_drawer_updated_at
    BEFORE UPDATE ON cash_drawer_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),        -- NULL for broadcast
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;
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
