-- Migration: 012_void_refund_permissions.sql
-- Description: Grant void and refund permissions to manager and super_admin roles
-- Created: 2026-01-11

-- Ensure manager has void and refund permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager'
AND p.name IN (
    'sales.void',
    'sales.refund',
    'sales.authorize_void',
    'sales.authorize_refund'
)
ON CONFLICT DO NOTHING;

-- Ensure super_admin has void and refund permissions (should already have them, but just in case)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
AND p.name IN (
    'sales.void',
    'sales.refund',
    'sales.authorize_void',
    'sales.authorize_refund'
)
ON CONFLICT DO NOTHING;

-- Update existing super_admin and manager users to be able to authorize void and refund
UPDATE users 
SET 
    can_authorize_void = TRUE,
    can_authorize_refund = TRUE
WHERE role_id IN (
    SELECT id FROM roles WHERE name IN ('super_admin', 'manager')
);

-- Create a trigger to automatically set can_authorize_void and can_authorize_refund for new super_admin and manager users
CREATE OR REPLACE FUNCTION set_authorization_flags()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the user is super_admin or manager
    IF EXISTS (
        SELECT 1 FROM roles 
        WHERE id = NEW.role_id 
        AND name IN ('super_admin', 'manager')
    ) THEN
        NEW.can_authorize_void := TRUE;
        NEW.can_authorize_refund := TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS set_user_authorization_flags ON users;

-- Create trigger for new users
CREATE TRIGGER set_user_authorization_flags
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_authorization_flags();

-- Also trigger on update (in case role changes)
DROP TRIGGER IF EXISTS update_user_authorization_flags ON users;

CREATE TRIGGER update_user_authorization_flags
    BEFORE UPDATE OF role_id ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_authorization_flags();
