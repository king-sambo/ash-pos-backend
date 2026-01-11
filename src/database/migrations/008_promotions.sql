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
