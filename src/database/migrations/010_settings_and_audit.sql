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
