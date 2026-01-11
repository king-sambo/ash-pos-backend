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
