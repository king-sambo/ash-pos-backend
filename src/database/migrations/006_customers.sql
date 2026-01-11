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
