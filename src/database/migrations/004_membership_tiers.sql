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
