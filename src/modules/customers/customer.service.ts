/**
 * Customer Service
 * Handles all customer-related business logic
 */

import { pool } from "../../config/database";
import { NotFoundError, BadRequestError, ConflictError } from "../../shared/errors/AppError";

export interface Customer {
  id: string;
  customerCode: string;
  membershipId: string | null;
  membershipBarcode: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  birthdate: string | null;
  gender: string | null;
  membershipTierId: string | null;
  membershipTierName: string | null;
  membershipIssuedAt: string | null;
  membershipExpiresAt: string | null;
  membershipCardIssued: boolean;
  isSeniorCitizen: boolean;
  seniorCitizenId: string | null;
  isPwd: boolean;
  pwdId: string | null;
  isSoloParent: boolean;
  soloParentId: string | null;
  idVerified: boolean;
  loyaltyPoints: number;
  lifetimeSpend: number;
  totalTransactions: number;
  lastTransactionAt: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthdate: string;
  gender: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  membershipTierId?: string;
  isSeniorCitizen?: boolean;
  seniorCitizenId?: string;
  isPwd?: boolean;
  pwdId?: string;
  isSoloParent?: boolean;
  soloParentId?: string;
  notes?: string;
  createdBy?: string;
}

export interface UpdateCustomerData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  birthdate?: string;
  gender?: string;
  membershipTierId?: string;
  isSeniorCitizen?: boolean;
  seniorCitizenId?: string;
  isPwd?: boolean;
  pwdId?: string;
  isSoloParent?: boolean;
  soloParentId?: string;
  notes?: string;
  isActive?: boolean;
}

export interface CustomerListOptions {
  page?: number;
  limit?: number;
  search?: string;
  membershipTierId?: string;
  isSeniorCitizen?: boolean;
  isPwd?: boolean;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface CustomerRow {
  id: string;
  customer_code: string;
  membership_id: string | null;
  membership_barcode: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  birthdate: string | null;
  gender: string | null;
  membership_tier_id: string | null;
  tier_name: string | null;
  membership_issued_at: string | null;
  membership_expires_at: string | null;
  membership_card_issued: boolean;
  is_senior_citizen: boolean;
  senior_citizen_id: string | null;
  is_pwd: boolean;
  pwd_id: string | null;
  is_solo_parent: boolean;
  solo_parent_id: string | null;
  id_verified: boolean;
  loyalty_points: number;
  lifetime_spend: string;
  total_transactions: number;
  last_transaction_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapCustomerRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    customerCode: row.customer_code,
    membershipId: row.membership_id,
    membershipBarcode: row.membership_barcode,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    birthdate: row.birthdate,
    gender: row.gender,
    membershipTierId: row.membership_tier_id,
    membershipTierName: row.tier_name,
    membershipIssuedAt: row.membership_issued_at,
    membershipExpiresAt: row.membership_expires_at,
    membershipCardIssued: row.membership_card_issued,
    isSeniorCitizen: row.is_senior_citizen,
    seniorCitizenId: row.senior_citizen_id,
    isPwd: row.is_pwd,
    pwdId: row.pwd_id,
    isSoloParent: row.is_solo_parent,
    soloParentId: row.solo_parent_id,
    idVerified: row.id_verified,
    loyaltyPoints: row.loyalty_points,
    lifetimeSpend: parseFloat(row.lifetime_spend || "0"),
    totalTransactions: row.total_transactions,
    lastTransactionAt: row.last_transaction_at,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const customerSelectFields = `
  c.id,
  c.customer_code,
  c.membership_id,
  c.membership_barcode,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.address,
  c.city,
  c.province,
  c.postal_code,
  c.birthdate,
  c.gender,
  c.membership_tier_id,
  mt.name as tier_name,
  c.membership_issued_at,
  c.membership_expires_at,
  c.membership_card_issued,
  c.is_senior_citizen,
  c.senior_citizen_id,
  c.is_pwd,
  c.pwd_id,
  c.is_solo_parent,
  c.solo_parent_id,
  c.id_verified,
  c.loyalty_points,
  c.lifetime_spend,
  c.total_transactions,
  c.last_transaction_at,
  c.notes,
  c.is_active,
  c.created_at,
  c.updated_at
`;

/**
 * Get all customers with pagination and filters
 */
export async function getAll(options: CustomerListOptions = {}): Promise<{
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    page = 1,
    limit = 10,
    search,
    membershipTierId,
    isSeniorCitizen,
    isPwd,
    isActive,
    sortBy = "created_at",
    sortOrder = "desc",
  } = options;

  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  let paramIndex = 1;

  const conditions: string[] = ["c.deleted_at IS NULL"];

  if (search) {
    conditions.push(`(
      c.first_name ILIKE $${paramIndex} OR 
      c.last_name ILIKE $${paramIndex} OR 
      c.email ILIKE $${paramIndex} OR 
      c.phone ILIKE $${paramIndex} OR
      c.customer_code ILIKE $${paramIndex} OR
      c.membership_id ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (membershipTierId) {
    conditions.push(`c.membership_tier_id = $${paramIndex}`);
    params.push(membershipTierId);
    paramIndex++;
  }

  if (isSeniorCitizen !== undefined) {
    conditions.push(`c.is_senior_citizen = $${paramIndex}`);
    params.push(isSeniorCitizen);
    paramIndex++;
  }

  if (isPwd !== undefined) {
    conditions.push(`c.is_pwd = $${paramIndex}`);
    params.push(isPwd);
    paramIndex++;
  }

  if (isActive !== undefined) {
    conditions.push(`c.is_active = $${paramIndex}`);
    params.push(isActive);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const allowedSortColumns = ["first_name", "last_name", "customer_code", "loyalty_points", "lifetime_spend", "created_at", "last_transaction_at"];
  const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : "created_at";
  const safeOrder = sortOrder === "asc" ? "ASC" : "DESC";

  const client = await pool.connect();
  try {
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM customers c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await client.query(
      `SELECT ${customerSelectFields}
      FROM customers c
      LEFT JOIN membership_tiers mt ON c.membership_tier_id = mt.id
      ${whereClause}
      ORDER BY c.${safeSort} ${safeOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      customers: result.rows.map((row: CustomerRow) => mapCustomerRow(row)),
      total,
      page,
      limit,
    };
  } finally {
    client.release();
  }
}

/**
 * Get customer by ID
 */
export async function getById(id: string): Promise<Customer> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT ${customerSelectFields}
      FROM customers c
      LEFT JOIN membership_tiers mt ON c.membership_tier_id = mt.id
      WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Customer not found");
    }

    return mapCustomerRow(result.rows[0] as CustomerRow);
  } finally {
    client.release();
  }
}

/**
 * Search customer by code, membership ID, or barcode
 */
export async function search(query: string): Promise<Customer | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT ${customerSelectFields}
      FROM customers c
      LEFT JOIN membership_tiers mt ON c.membership_tier_id = mt.id
      WHERE c.deleted_at IS NULL AND (
        c.customer_code = $1 OR 
        c.membership_id = $1 OR 
        c.membership_barcode = $1 OR
        c.phone = $1
      )`,
      [query]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapCustomerRow(result.rows[0] as CustomerRow);
  } finally {
    client.release();
  }
}

/**
 * Create a new customer
 */
export async function create(data: CreateCustomerData): Promise<Customer> {
  const client = await pool.connect();
  try {
    // Validate required fields
    if (!data.email || !data.email.trim()) {
      throw new BadRequestError("Email is required");
    }
    if (!data.phone || !data.phone.trim()) {
      throw new BadRequestError("Phone is required");
    }
    if (!data.birthdate || !data.birthdate.trim()) {
      throw new BadRequestError("Birthdate is required");
    }
    if (!data.gender || !data.gender.trim()) {
      throw new BadRequestError("Gender is required");
    }

    // Check email uniqueness
    const emailCheck = await client.query(
      "SELECT id FROM customers WHERE email = $1 AND deleted_at IS NULL",
      [data.email]
    );
    if (emailCheck.rows.length > 0) {
      throw new ConflictError("Email already exists");
    }

    // Check phone uniqueness
    const phoneCheck = await client.query(
      "SELECT id FROM customers WHERE phone = $1 AND deleted_at IS NULL",
      [data.phone]
    );
    if (phoneCheck.rows.length > 0) {
      throw new ConflictError("Phone number already exists");
    }

    const result = await client.query(
      `INSERT INTO customers (
        first_name, last_name, email, phone, address, city, province, postal_code,
        birthdate, gender, membership_tier_id, is_senior_citizen, senior_citizen_id,
        is_pwd, pwd_id, is_solo_parent, solo_parent_id, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id`,
      [
        data.firstName,
        data.lastName,
        data.email,
        data.phone,
        data.address || null,
        data.city || null,
        data.province || null,
        data.postalCode || null,
        data.birthdate,
        data.gender,
        data.membershipTierId || null,
        data.isSeniorCitizen || false,
        data.seniorCitizenId || null,
        data.isPwd || false,
        data.pwdId || null,
        data.isSoloParent || false,
        data.soloParentId || null,
        data.notes || null,
        data.createdBy || null,
      ]
    );

    return getById(result.rows[0].id);
  } finally {
    client.release();
  }
}

/**
 * Helper function to sanitize optional string fields (convert empty strings to null)
 */
function sanitizeOptionalString(value: string | undefined): string | null {
  if (value === undefined || value === null || value.trim() === "") {
    return null;
  }
  return value;
}

/**
 * Update a customer
 */
export async function update(id: string, data: UpdateCustomerData): Promise<Customer> {
  const client = await pool.connect();
  try {
    const existingCustomer = await client.query(
      "SELECT id FROM customers WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (existingCustomer.rows.length === 0) {
      throw new NotFoundError("Customer not found");
    }

    // Validate required fields if they are being updated
    if (data.email !== undefined && (!data.email || !data.email.trim())) {
      throw new BadRequestError("Email cannot be empty");
    }
    if (data.phone !== undefined && (!data.phone || !data.phone.trim())) {
      throw new BadRequestError("Phone cannot be empty");
    }
    if (data.birthdate !== undefined && (!data.birthdate || !data.birthdate.trim())) {
      throw new BadRequestError("Birthdate cannot be empty");
    }
    if (data.gender !== undefined && (!data.gender || !data.gender.trim())) {
      throw new BadRequestError("Gender cannot be empty");
    }

    // Check email uniqueness if updating
    if (data.email) {
      const emailCheck = await client.query(
        "SELECT id FROM customers WHERE email = $1 AND id != $2 AND deleted_at IS NULL",
        [data.email, id]
      );
      if (emailCheck.rows.length > 0) {
        throw new ConflictError("Email already exists");
      }
    }

    // Check phone uniqueness if updating
    if (data.phone) {
      const phoneCheck = await client.query(
        "SELECT id FROM customers WHERE phone = $1 AND id != $2 AND deleted_at IS NULL",
        [data.phone, id]
      );
      if (phoneCheck.rows.length > 0) {
        throw new ConflictError("Phone number already exists");
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Fields that should be sanitized (empty string -> null for optional fields)
    const optionalStringFields = ["address", "city", "province", "postalCode", "membershipTierId", "seniorCitizenId", "pwdId", "soloParentId", "notes"];
    
    const fieldMappings: Record<string, string> = {
      firstName: "first_name",
      lastName: "last_name",
      email: "email",
      phone: "phone",
      address: "address",
      city: "city",
      province: "province",
      postalCode: "postal_code",
      birthdate: "birthdate",
      gender: "gender",
      membershipTierId: "membership_tier_id",
      isSeniorCitizen: "is_senior_citizen",
      seniorCitizenId: "senior_citizen_id",
      isPwd: "is_pwd",
      pwdId: "pwd_id",
      isSoloParent: "is_solo_parent",
      soloParentId: "solo_parent_id",
      notes: "notes",
      isActive: "is_active",
    };

    for (const [key, column] of Object.entries(fieldMappings)) {
      if (data[key as keyof UpdateCustomerData] !== undefined) {
        updates.push(`${column} = $${paramIndex++}`);
        // Sanitize optional string fields
        if (optionalStringFields.includes(key)) {
          params.push(sanitizeOptionalString(data[key as keyof UpdateCustomerData] as string));
        } else {
          params.push(data[key as keyof UpdateCustomerData]);
        }
      }
    }

    if (updates.length === 0) {
      throw new BadRequestError("No fields to update");
    }

    params.push(id);
    await client.query(
      `UPDATE customers SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${paramIndex}`,
      params
    );

    return getById(id);
  } finally {
    client.release();
  }
}

/**
 * Soft delete a customer
 */
export async function remove(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE customers SET deleted_at = NOW(), is_active = false 
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Customer not found");
    }
  } finally {
    client.release();
  }
}

/**
 * Issue membership card
 */
export async function issueMembership(
  id: string,
  tierId: string,
  membershipId?: string,
  barcode?: string
): Promise<Customer> {
  const client = await pool.connect();
  try {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year validity

    await client.query(
      `UPDATE customers SET 
        membership_tier_id = $1,
        membership_id = COALESCE($2, membership_id, 'MEM-' || customer_code),
        membership_barcode = $3,
        membership_issued_at = NOW(),
        membership_expires_at = $4,
        membership_card_issued = true
       WHERE id = $5 AND deleted_at IS NULL`,
      [tierId, membershipId || null, barcode || null, expiresAt.toISOString(), id]
    );

    return getById(id);
  } finally {
    client.release();
  }
}

/**
 * Renew membership
 */
export async function renewMembership(id: string, newCardIssued: boolean = false): Promise<Customer> {
  const client = await pool.connect();
  try {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await client.query(
      `UPDATE customers SET 
        membership_expires_at = $1,
        membership_renewed_at = NOW(),
        membership_card_issued = CASE WHEN $2 THEN true ELSE membership_card_issued END
       WHERE id = $3 AND deleted_at IS NULL`,
      [expiresAt.toISOString(), newCardIssued, id]
    );

    return getById(id);
  } finally {
    client.release();
  }
}

/**
 * Get membership tiers
 */
export async function getMembershipTiers(): Promise<{ id: string; name: string; discountPercentage: number; pointsMultiplier: number }[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, name, discount_percentage, points_multiplier 
       FROM membership_tiers 
       WHERE is_active = true 
       ORDER BY min_spend ASC`
    );
    return result.rows.map((row: { id: string; name: string; discount_percentage: string; points_multiplier: string }) => ({
      id: row.id,
      name: row.name,
      discountPercentage: parseFloat(row.discount_percentage),
      pointsMultiplier: parseFloat(row.points_multiplier),
    }));
  } finally {
    client.release();
  }
}

/**
 * Add loyalty points
 */
export async function addLoyaltyPoints(
  id: string,
  points: number,
  transactionType: "earn" | "bonus" | "adjust",
  description: string,
  referenceId?: string,
  createdBy?: string
): Promise<Customer> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get current points
    const customerResult = await client.query(
      "SELECT loyalty_points FROM customers WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (customerResult.rows.length === 0) {
      throw new NotFoundError("Customer not found");
    }

    const currentPoints = customerResult.rows[0].loyalty_points;
    const newBalance = currentPoints + points;

    // Update customer points
    await client.query(
      "UPDATE customers SET loyalty_points = $1 WHERE id = $2",
      [newBalance, id]
    );

    // Record history
    await client.query(
      `INSERT INTO loyalty_points_history (
        customer_id, transaction_type, points, balance_after, 
        reference_type, reference_id, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, transactionType, points, newBalance, "manual", referenceId || null, description, createdBy || null]
    );

    await client.query("COMMIT");
    return getById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Redeem loyalty points
 */
export async function redeemLoyaltyPoints(
  id: string,
  points: number,
  description: string,
  referenceId?: string,
  createdBy?: string
): Promise<Customer> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const customerResult = await client.query(
      "SELECT loyalty_points FROM customers WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (customerResult.rows.length === 0) {
      throw new NotFoundError("Customer not found");
    }

    const currentPoints = customerResult.rows[0].loyalty_points;
    if (currentPoints < points) {
      throw new BadRequestError("Insufficient loyalty points");
    }

    const newBalance = currentPoints - points;

    await client.query(
      "UPDATE customers SET loyalty_points = $1 WHERE id = $2",
      [newBalance, id]
    );

    await client.query(
      `INSERT INTO loyalty_points_history (
        customer_id, transaction_type, points, balance_after, 
        reference_type, reference_id, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, "redeem", -points, newBalance, "redemption", referenceId || null, description, createdBy || null]
    );

    await client.query("COMMIT");
    return getById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
