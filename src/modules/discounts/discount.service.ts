/**
 * Discounts Service
 * Handles government-mandated, membership, and manual discounts
 */

import { pool } from "../../config/database";
import { NotFoundError, BadRequestError } from "../../shared/errors/AppError";

export interface DiscountSetting {
  id: string;
  discountType: string;
  name: string;
  description?: string;
  percentage: number;
  isVatExempt: boolean;
  requiresId: boolean;
  idType?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountReason {
  id: string;
  code: string;
  name: string;
  description?: string;
  requiresApproval: boolean;
  maxPercentage?: number;
  isActive: boolean;
  sortOrder: number;
}

export interface MembershipTier {
  id: string;
  name: string;
  description?: string;
  minSpend: number;
  maxSpend?: number;
  discountPercentage: number;
  pointsMultiplier: number;
  benefits?: any;
  color?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CustomerGroup {
  id: string;
  name: string;
  description?: string;
  discountPercentage: number;
  isSystem: boolean;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
}

/**
 * Get all discount settings
 */
export async function getDiscountSettings(): Promise<DiscountSetting[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM discount_settings ORDER BY discount_type
    `);
    return result.rows.map(mapDiscountSetting);
  } finally {
    client.release();
  }
}

/**
 * Update discount setting
 */
export async function updateDiscountSetting(
  discountType: string,
  data: Partial<DiscountSetting>
): Promise<DiscountSetting> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE discount_settings SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        percentage = COALESCE($3, percentage),
        is_vat_exempt = COALESCE($4, is_vat_exempt),
        requires_id = COALESCE($5, requires_id),
        id_type = COALESCE($6, id_type),
        is_active = COALESCE($7, is_active),
        updated_at = NOW()
       WHERE discount_type = $8
       RETURNING *`,
      [
        data.name,
        data.description,
        data.percentage,
        data.isVatExempt,
        data.requiresId,
        data.idType,
        data.isActive,
        discountType,
      ]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Discount setting not found");
    }
    return mapDiscountSetting(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Get all discount reasons
 */
export async function getDiscountReasons(): Promise<DiscountReason[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM discount_reasons ORDER BY sort_order
    `);
    return result.rows.map(mapDiscountReason);
  } finally {
    client.release();
  }
}

/**
 * Create discount reason
 */
export async function createDiscountReason(
  data: { code: string; name: string; description?: string; requiresApproval?: boolean; maxPercentage?: number; sortOrder?: number }
): Promise<DiscountReason> {
  const client = await pool.connect();
  try {
    // Get the max sort order if not provided
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxResult = await client.query(`SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM discount_reasons`);
      sortOrder = maxResult.rows[0].next_order;
    }

    const result = await client.query(
      `INSERT INTO discount_reasons (code, name, description, requires_approval, max_percentage, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING *`,
      [
        data.code.toLowerCase().replace(/\s+/g, '_'),
        data.name,
        data.description || null,
        data.requiresApproval || false,
        data.maxPercentage || null,
        sortOrder,
      ]
    );
    return mapDiscountReason(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Update discount reason
 */
export async function updateDiscountReason(
  id: string,
  data: Partial<{ code: string; name: string; description: string; requiresApproval: boolean; maxPercentage: number; sortOrder: number; isActive: boolean }>
): Promise<DiscountReason> {
  const client = await pool.connect();
  try {
    const check = await client.query(`SELECT id FROM discount_reasons WHERE id = $1`, [id]);
    if (check.rows.length === 0) {
      throw new NotFoundError("Discount reason not found");
    }

    const result = await client.query(
      `UPDATE discount_reasons SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        requires_approval = COALESCE($4, requires_approval),
        max_percentage = COALESCE($5, max_percentage),
        sort_order = COALESCE($6, sort_order),
        is_active = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING *`,
      [
        data.code ? data.code.toLowerCase().replace(/\s+/g, '_') : null,
        data.name,
        data.description,
        data.requiresApproval,
        data.maxPercentage,
        data.sortOrder,
        data.isActive,
        id,
      ]
    );

    return mapDiscountReason(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Delete discount reason
 */
export async function deleteDiscountReason(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    const check = await client.query(`SELECT id FROM discount_reasons WHERE id = $1`, [id]);
    if (check.rows.length === 0) {
      throw new NotFoundError("Discount reason not found");
    }

    await client.query(`DELETE FROM discount_reasons WHERE id = $1`, [id]);
  } finally {
    client.release();
  }
}

/**
 * Get all membership tiers
 */
export async function getMembershipTiers(): Promise<MembershipTier[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM membership_tiers ORDER BY sort_order
    `);
    return result.rows.map(mapMembershipTier);
  } finally {
    client.release();
  }
}

/**
 * Create membership tier
 */
export async function createMembershipTier(data: Partial<MembershipTier>): Promise<MembershipTier> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO membership_tiers (
        name, description, min_spend, max_spend, discount_percentage, 
        points_multiplier, benefits, color, icon, sort_order, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.name,
        data.description,
        data.minSpend || 0,
        data.maxSpend,
        data.discountPercentage || 0,
        data.pointsMultiplier || 1,
        data.benefits ? JSON.stringify(data.benefits) : null,
        data.color,
        data.icon,
        data.sortOrder || 0,
        data.isActive ?? true,
      ]
    );
    return mapMembershipTier(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Update membership tier
 */
export async function updateMembershipTier(id: string, data: Partial<MembershipTier>): Promise<MembershipTier> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE membership_tiers SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        min_spend = COALESCE($3, min_spend),
        max_spend = COALESCE($4, max_spend),
        discount_percentage = COALESCE($5, discount_percentage),
        points_multiplier = COALESCE($6, points_multiplier),
        benefits = COALESCE($7, benefits),
        color = COALESCE($8, color),
        icon = COALESCE($9, icon),
        sort_order = COALESCE($10, sort_order),
        is_active = COALESCE($11, is_active),
        updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        data.name,
        data.description,
        data.minSpend,
        data.maxSpend,
        data.discountPercentage,
        data.pointsMultiplier,
        data.benefits ? JSON.stringify(data.benefits) : null,
        data.color,
        data.icon,
        data.sortOrder,
        data.isActive,
        id,
      ]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Membership tier not found");
    }
    return mapMembershipTier(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Get all customer groups
 */
export async function getCustomerGroups(): Promise<CustomerGroup[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        cg.*,
        COUNT(cgm.customer_id)::int as member_count
      FROM customer_groups cg
      LEFT JOIN customer_group_members cgm ON cg.id = cgm.group_id
      WHERE cg.is_active = TRUE
      GROUP BY cg.id
      ORDER BY cg.name
    `);
    return result.rows.map(mapCustomerGroup);
  } finally {
    client.release();
  }
}

/**
 * Create customer group
 */
export async function createCustomerGroup(
  data: { name: string; description?: string; discountPercentage: number }
): Promise<CustomerGroup> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO customer_groups (name, description, discount_percentage, is_predefined, is_active)
       VALUES ($1, $2, $3, FALSE, TRUE)
       RETURNING *`,
      [data.name, data.description, data.discountPercentage]
    );
    return { ...mapCustomerGroup(result.rows[0]), memberCount: 0 };
  } finally {
    client.release();
  }
}

/**
 * Update customer group
 */
export async function updateCustomerGroup(
  id: string,
  data: Partial<{ name: string; description: string; discountPercentage: number; isActive: boolean }>
): Promise<CustomerGroup> {
  const client = await pool.connect();
  try {
    // Check if predefined (system) group
    const check = await client.query(`SELECT is_predefined FROM customer_groups WHERE id = $1`, [id]);
    if (check.rows.length === 0) {
      throw new NotFoundError("Customer group not found");
    }
    if (check.rows[0].is_predefined && data.name) {
      throw new BadRequestError("Cannot rename system groups");
    }

    const result = await client.query(
      `UPDATE customer_groups SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        discount_percentage = COALESCE($3, discount_percentage),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [data.name, data.description, data.discountPercentage, data.isActive, id]
    );

    return mapCustomerGroup(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Delete customer group
 */
export async function deleteCustomerGroup(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if predefined (system) group
    const check = await client.query(`SELECT is_predefined FROM customer_groups WHERE id = $1`, [id]);
    if (check.rows.length === 0) {
      throw new NotFoundError("Customer group not found");
    }
    if (check.rows[0].is_predefined) {
      throw new BadRequestError("Cannot delete system groups");
    }

    await client.query(`DELETE FROM customer_groups WHERE id = $1`, [id]);
  } finally {
    client.release();
  }
}

/**
 * Calculate applicable discounts for a transaction
 */
export async function calculateDiscounts(params: {
  subtotal: number;
  customerId?: string;
  isSeniorCitizen?: boolean;
  isPwd?: boolean;
  membershipTierId?: string;
}): Promise<{
  governmentDiscount: number;
  membershipDiscount: number;
  isVatExempt: boolean;
  appliedDiscounts: { type: string; name: string; percentage: number; amount: number }[];
}> {
  const { subtotal, customerId, isSeniorCitizen, isPwd, membershipTierId } = params;
  const client = await pool.connect();
  
  try {
    const appliedDiscounts: { type: string; name: string; percentage: number; amount: number }[] = [];
    let governmentDiscount = 0;
    let membershipDiscount = 0;
    let isVatExempt = false;

    // Get government discount settings
    const govDiscounts = await client.query(`
      SELECT * FROM discount_settings WHERE is_active = TRUE AND discount_type IN ('senior_citizen', 'pwd')
    `);

    // Apply SC discount (takes priority)
    if (isSeniorCitizen) {
      const scDiscount = govDiscounts.rows.find((d: any) => d.discount_type === "senior_citizen");
      if (scDiscount) {
        governmentDiscount = subtotal * (parseFloat(scDiscount.percentage) / 100);
        isVatExempt = scDiscount.is_vat_exempt;
        appliedDiscounts.push({
          type: "senior_citizen",
          name: scDiscount.name,
          percentage: parseFloat(scDiscount.percentage),
          amount: governmentDiscount,
        });
      }
    }
    // Apply PWD discount if SC not applied
    else if (isPwd) {
      const pwdDiscount = govDiscounts.rows.find((d: any) => d.discount_type === "pwd");
      if (pwdDiscount) {
        governmentDiscount = subtotal * (parseFloat(pwdDiscount.percentage) / 100);
        isVatExempt = pwdDiscount.is_vat_exempt;
        appliedDiscounts.push({
          type: "pwd",
          name: pwdDiscount.name,
          percentage: parseFloat(pwdDiscount.percentage),
          amount: governmentDiscount,
        });
      }
    }

    // Apply membership discount (can stack with government)
    if (membershipTierId) {
      const tierResult = await client.query(
        `SELECT * FROM membership_tiers WHERE id = $1 AND is_active = TRUE`,
        [membershipTierId]
      );
      if (tierResult.rows.length > 0) {
        const tier = tierResult.rows[0];
        const discountableAmount = subtotal - governmentDiscount;
        membershipDiscount = discountableAmount * (parseFloat(tier.discount_percentage) / 100);
        if (membershipDiscount > 0) {
          appliedDiscounts.push({
            type: "membership",
            name: tier.name,
            percentage: parseFloat(tier.discount_percentage),
            amount: membershipDiscount,
          });
        }
      }
    }

    return {
      governmentDiscount,
      membershipDiscount,
      isVatExempt,
      appliedDiscounts,
    };
  } finally {
    client.release();
  }
}

// Mappers
function mapDiscountSetting(row: any): DiscountSetting {
  return {
    id: row.id,
    discountType: row.discount_type,
    name: row.name,
    description: row.description,
    percentage: parseFloat(row.percentage),
    isVatExempt: row.is_vat_exempt,
    requiresId: row.requires_id,
    idType: row.id_type,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDiscountReason(row: any): DiscountReason {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    requiresApproval: row.requires_approval,
    maxPercentage: row.max_percentage ? parseFloat(row.max_percentage) : undefined,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function mapMembershipTier(row: any): MembershipTier {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    minSpend: parseFloat(row.min_spend),
    maxSpend: row.max_spend ? parseFloat(row.max_spend) : undefined,
    discountPercentage: parseFloat(row.discount_percentage),
    pointsMultiplier: parseFloat(row.points_multiplier),
    benefits: row.benefits,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function mapCustomerGroup(row: any): CustomerGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    discountPercentage: parseFloat(row.discount_percentage || 0),
    isSystem: row.is_predefined,
    isActive: row.is_active,
    memberCount: row.member_count || 0,
    createdAt: row.created_at,
  };
}
