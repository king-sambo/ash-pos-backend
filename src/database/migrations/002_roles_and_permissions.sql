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
