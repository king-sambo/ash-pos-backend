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
