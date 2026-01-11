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
