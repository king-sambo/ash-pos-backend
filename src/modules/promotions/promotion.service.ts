/**
 * Promotions Service
 */

import { pool } from "../../config/database";
import { NotFoundError, BadRequestError } from "../../shared/errors/AppError";

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  code?: string;
  promotionType: string;
  discountValue: number;
  buyQuantity?: number;
  getQuantity?: number;
  getProductId?: string;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  minQuantity?: number;
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  currentUsage: number;
  targetType: string;
  targetProducts?: string[];
  targetCategories?: string[];
  targetCustomers?: string[];
  targetGroups?: string[];
  targetMembershipTiers?: string[];
  startDate: string;
  endDate: string;
  activeDays?: number[];
  activeHours?: { start: string; end: string };
  isStackable: boolean;
  priority: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromotionData {
  name: string;
  description?: string;
  code?: string;
  promotionType: string;
  discountValue: number;
  buyQuantity?: number;
  getQuantity?: number;
  getProductId?: string;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  minQuantity?: number;
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  targetType?: string;
  targetProducts?: string[];
  targetCategories?: string[];
  targetCustomers?: string[];
  targetGroups?: string[];
  targetMembershipTiers?: string[];
  startDate: string;
  endDate: string;
  activeDays?: number[];
  activeHours?: { start: string; end: string };
  isStackable?: boolean;
  priority?: number;
  isActive?: boolean;
}

interface ListOptions {
  page?: number;
  limit?: number;
  promotionType?: string;
  isActive?: boolean;
  search?: string;
}

/**
 * Get all promotions
 */
export async function getAll(options: ListOptions = {}): Promise<{
  promotions: Promotion[];
  total: number;
  page: number;
  limit: number;
}> {
  const { page = 1, limit = 20, promotionType, isActive, search } = options;
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  let paramIndex = 1;
  const conditions: string[] = [];

  if (promotionType) {
    conditions.push(`promotion_type = $${paramIndex++}`);
    params.push(promotionType);
  }

  if (isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    params.push(isActive);
  }

  if (search) {
    conditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const client = await pool.connect();
  try {
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM promotions ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await client.query(
      `SELECT * FROM promotions ${whereClause}
       ORDER BY priority DESC, created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      promotions: result.rows.map(mapPromotion),
      total,
      page,
      limit,
    };
  } finally {
    client.release();
  }
}

/**
 * Get active promotions
 */
export async function getActive(): Promise<Promotion[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM promotions
      WHERE is_active = TRUE
        AND start_date <= NOW()
        AND end_date >= NOW()
      ORDER BY priority DESC
    `);
    return result.rows.map(mapPromotion);
  } finally {
    client.release();
  }
}

/**
 * Get promotion by ID
 */
export async function getById(id: string): Promise<Promotion> {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM promotions WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      throw new NotFoundError("Promotion not found");
    }
    return mapPromotion(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Get promotion by code
 */
export async function getByCode(code: string): Promise<Promotion | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM promotions WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
      [code]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return mapPromotion(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Create promotion
 */
export async function create(data: CreatePromotionData, userId: string): Promise<Promotion> {
  const client = await pool.connect();
  try {
    // Sanitize code - convert empty string to null
    const code = data.code?.trim() || null;

    // Validate code uniqueness if provided
    if (code) {
      const existing = await client.query(
        `SELECT id FROM promotions WHERE UPPER(code) = UPPER($1)`,
        [code]
      );
      if (existing.rows.length > 0) {
        throw new BadRequestError("Promotion code already exists");
      }
    }

    const result = await client.query(
      `INSERT INTO promotions (
        name, description, code, promotion_type, discount_value,
        buy_quantity, get_quantity, get_product_id,
        min_purchase_amount, max_discount_amount, min_quantity,
        usage_limit, usage_limit_per_customer,
        target_type, target_products, target_categories, target_customers, target_groups, target_membership_tiers,
        start_date, end_date, active_days, active_hours,
        is_stackable, priority, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      RETURNING *`,
      [
        data.name,
        data.description,
        code?.toUpperCase() || null,
        data.promotionType,
        data.discountValue,
        data.buyQuantity,
        data.getQuantity,
        data.getProductId,
        data.minPurchaseAmount,
        data.maxDiscountAmount,
        data.minQuantity,
        data.usageLimit,
        data.usageLimitPerCustomer,
        data.targetType || "all",
        data.targetProducts ? JSON.stringify(data.targetProducts) : null,
        data.targetCategories ? JSON.stringify(data.targetCategories) : null,
        data.targetCustomers ? JSON.stringify(data.targetCustomers) : null,
        data.targetGroups ? JSON.stringify(data.targetGroups) : null,
        data.targetMembershipTiers ? JSON.stringify(data.targetMembershipTiers) : null,
        data.startDate,
        data.endDate,
        data.activeDays ? JSON.stringify(data.activeDays) : null,
        data.activeHours ? JSON.stringify(data.activeHours) : null,
        data.isStackable ?? false,
        data.priority ?? 0,
        data.isActive ?? true,
        userId,
      ]
    );

    return mapPromotion(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Update promotion
 */
export async function update(id: string, data: Partial<CreatePromotionData>): Promise<Promotion> {
  const client = await pool.connect();
  try {
    const existing = await getById(id);

    // Sanitize code - convert empty string to null, undefined means no change
    const code = data.code !== undefined ? (data.code?.trim() || null) : undefined;

    // Validate code uniqueness if changing
    if (code && code !== existing.code) {
      const codeCheck = await client.query(
        `SELECT id FROM promotions WHERE UPPER(code) = UPPER($1) AND id != $2`,
        [code, id]
      );
      if (codeCheck.rows.length > 0) {
        throw new BadRequestError("Promotion code already exists");
      }
    }

    const result = await client.query(
      `UPDATE promotions SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        code = COALESCE($3, code),
        promotion_type = COALESCE($4, promotion_type),
        discount_value = COALESCE($5, discount_value),
        buy_quantity = COALESCE($6, buy_quantity),
        get_quantity = COALESCE($7, get_quantity),
        get_product_id = COALESCE($8, get_product_id),
        min_purchase_amount = COALESCE($9, min_purchase_amount),
        max_discount_amount = COALESCE($10, max_discount_amount),
        min_quantity = COALESCE($11, min_quantity),
        usage_limit = COALESCE($12, usage_limit),
        usage_limit_per_customer = COALESCE($13, usage_limit_per_customer),
        target_type = COALESCE($14, target_type),
        target_products = COALESCE($15, target_products),
        target_categories = COALESCE($16, target_categories),
        target_customers = COALESCE($17, target_customers),
        target_groups = COALESCE($18, target_groups),
        target_membership_tiers = COALESCE($19, target_membership_tiers),
        start_date = COALESCE($20, start_date),
        end_date = COALESCE($21, end_date),
        active_days = COALESCE($22, active_days),
        active_hours = COALESCE($23, active_hours),
        is_stackable = COALESCE($24, is_stackable),
        priority = COALESCE($25, priority),
        is_active = COALESCE($26, is_active),
        updated_at = NOW()
      WHERE id = $27
      RETURNING *`,
      [
        data.name,
        data.description,
        code?.toUpperCase(),
        data.promotionType,
        data.discountValue,
        data.buyQuantity,
        data.getQuantity,
        data.getProductId,
        data.minPurchaseAmount,
        data.maxDiscountAmount,
        data.minQuantity,
        data.usageLimit,
        data.usageLimitPerCustomer,
        data.targetType,
        data.targetProducts ? JSON.stringify(data.targetProducts) : null,
        data.targetCategories ? JSON.stringify(data.targetCategories) : null,
        data.targetCustomers ? JSON.stringify(data.targetCustomers) : null,
        data.targetGroups ? JSON.stringify(data.targetGroups) : null,
        data.targetMembershipTiers ? JSON.stringify(data.targetMembershipTiers) : null,
        data.startDate,
        data.endDate,
        data.activeDays ? JSON.stringify(data.activeDays) : null,
        data.activeHours ? JSON.stringify(data.activeHours) : null,
        data.isStackable,
        data.priority,
        data.isActive,
        id,
      ]
    );

    return mapPromotion(result.rows[0]);
  } finally {
    client.release();
  }
}

/**
 * Delete promotion
 */
export async function remove(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query(`DELETE FROM promotions WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      throw new NotFoundError("Promotion not found");
    }
  } finally {
    client.release();
  }
}

/**
 * Check applicable promotions for a cart
 */
export async function checkApplicable(params: {
  items: { productId: string; categoryId?: string; quantity: number; price: number }[];
  customerId?: string;
  membershipTierId?: string;
  couponCode?: string;
}): Promise<{
  applicable: Promotion[];
  discountAmount: number;
}> {
  const { items, customerId, membershipTierId, couponCode } = params;
  const client = await pool.connect();
  
  try {
    // Get all active promotions
    const result = await client.query(`
      SELECT * FROM promotions
      WHERE is_active = TRUE
        AND start_date <= NOW()
        AND end_date >= NOW()
        AND (usage_limit IS NULL OR current_usage < usage_limit)
      ORDER BY priority DESC
    `);

    const activePromotions = result.rows.map(mapPromotion);
    const applicable: Promotion[] = [];
    let totalDiscount = 0;
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    for (const promo of activePromotions) {
      // Check coupon code match
      if (couponCode && promo.code && promo.code.toUpperCase() === couponCode.toUpperCase()) {
        if (checkPromotionConditions(promo, items, subtotal, customerId, membershipTierId)) {
          applicable.push(promo);
          totalDiscount += calculateDiscount(promo, items, subtotal);
          if (!promo.isStackable) break;
        }
        continue;
      }

      // Check auto-apply promotions (no code required)
      if (!promo.code) {
        if (checkPromotionConditions(promo, items, subtotal, customerId, membershipTierId)) {
          applicable.push(promo);
          totalDiscount += calculateDiscount(promo, items, subtotal);
          if (!promo.isStackable) break;
        }
      }
    }

    return { applicable, discountAmount: totalDiscount };
  } finally {
    client.release();
  }
}

/**
 * Record promotion usage
 */
export async function recordUsage(promotionId: string, customerId: string | null, saleId: string, discountAmount: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO promotion_usage (promotion_id, customer_id, sale_id, discount_amount)
       VALUES ($1, $2, $3, $4)`,
      [promotionId, customerId, saleId, discountAmount]
    );

    await client.query(
      `UPDATE promotions SET current_usage = current_usage + 1 WHERE id = $1`,
      [promotionId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Helper functions
function mapPromotion(row: any): Promotion {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    code: row.code,
    promotionType: row.promotion_type,
    discountValue: parseFloat(row.discount_value),
    buyQuantity: row.buy_quantity,
    getQuantity: row.get_quantity,
    getProductId: row.get_product_id,
    minPurchaseAmount: row.min_purchase_amount ? parseFloat(row.min_purchase_amount) : undefined,
    maxDiscountAmount: row.max_discount_amount ? parseFloat(row.max_discount_amount) : undefined,
    minQuantity: row.min_quantity,
    usageLimit: row.usage_limit,
    usageLimitPerCustomer: row.usage_limit_per_customer,
    currentUsage: row.current_usage,
    targetType: row.target_type,
    targetProducts: row.target_products,
    targetCategories: row.target_categories,
    targetCustomers: row.target_customers,
    targetGroups: row.target_groups,
    targetMembershipTiers: row.target_membership_tiers,
    startDate: row.start_date,
    endDate: row.end_date,
    activeDays: row.active_days,
    activeHours: row.active_hours,
    isStackable: row.is_stackable,
    priority: row.priority,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function checkPromotionConditions(
  promo: Promotion,
  items: { productId: string; categoryId?: string; quantity: number; price: number }[],
  subtotal: number,
  customerId?: string,
  membershipTierId?: string
): boolean {
  // Check minimum purchase
  if (promo.minPurchaseAmount && subtotal < promo.minPurchaseAmount) {
    return false;
  }

  // Check target type
  switch (promo.targetType) {
    case "products":
      if (promo.targetProducts && promo.targetProducts.length > 0) {
        const hasMatchingProduct = items.some((item) => promo.targetProducts!.includes(item.productId));
        if (!hasMatchingProduct) return false;
      }
      break;
    case "categories":
      if (promo.targetCategories && promo.targetCategories.length > 0) {
        const hasMatchingCategory = items.some((item) => item.categoryId && promo.targetCategories!.includes(item.categoryId));
        if (!hasMatchingCategory) return false;
      }
      break;
    case "customers":
      if (promo.targetCustomers && promo.targetCustomers.length > 0) {
        if (!customerId || !promo.targetCustomers.includes(customerId)) return false;
      }
      break;
    case "groups":
      // Would need to check customer group membership
      break;
  }

  // Check membership tier
  if (promo.targetMembershipTiers && promo.targetMembershipTiers.length > 0) {
    if (!membershipTierId || !promo.targetMembershipTiers.includes(membershipTierId)) {
      return false;
    }
  }

  return true;
}

function calculateDiscount(
  promo: Promotion,
  items: { productId: string; quantity: number; price: number }[],
  subtotal: number
): number {
  let discount = 0;

  switch (promo.promotionType) {
    case "percentage":
      discount = subtotal * (promo.discountValue / 100);
      break;
    case "fixed_amount":
      discount = promo.discountValue;
      break;
    case "buy_x_get_y":
      // Find matching items and calculate free item value
      if (promo.buyQuantity && promo.getQuantity) {
        for (const item of items) {
          if (!promo.targetProducts || promo.targetProducts.includes(item.productId)) {
            const sets = Math.floor(item.quantity / (promo.buyQuantity + promo.getQuantity));
            discount += sets * promo.getQuantity * item.price;
          }
        }
      }
      break;
  }

  // Apply max discount cap
  if (promo.maxDiscountAmount && discount > promo.maxDiscountAmount) {
    discount = promo.maxDiscountAmount;
  }

  return discount;
}
