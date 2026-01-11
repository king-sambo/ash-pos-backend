/**
 * Inventory Service
 * Handles stock movements, inventory counts, and stock management
 */

import { pool } from "../../config/database";
import { NotFoundError, BadRequestError } from "../../shared/errors/AppError";

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  variantId: string | null;
  movementType: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  unitCost: number | null;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface InventorySummary {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  recentMovements: StockMovement[];
}

export interface StockMovementListOptions {
  page?: number;
  limit?: number;
  productId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: "asc" | "desc";
}

interface StockMovementRow {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  variant_id: string | null;
  movement_type: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: string | null;
  unit_cost: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

function mapStockMovementRow(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    variantId: row.variant_id,
    movementType: row.movement_type,
    quantity: row.quantity,
    quantityBefore: row.quantity_before,
    quantityAfter: row.quantity_after,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
    notes: row.notes,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

/**
 * Get inventory summary
 */
export async function getSummary(): Promise<InventorySummary> {
  const client = await pool.connect();
  try {
    // Get product counts
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total_products,
        SUM(current_stock * cost_price) as total_stock_value,
        COUNT(*) FILTER (WHERE track_inventory = true AND current_stock <= low_stock_threshold AND current_stock > 0) as low_stock_count,
        COUNT(*) FILTER (WHERE track_inventory = true AND current_stock <= 0) as out_of_stock_count
      FROM products
      WHERE deleted_at IS NULL AND status = 'active'
    `);

    const stats = statsResult.rows[0];

    // Get recent movements
    const movementsResult = await client.query(`
      SELECT 
        sm.id, sm.product_id, p.name as product_name, p.sku as product_sku,
        sm.variant_id, sm.movement_type, sm.quantity, sm.quantity_before, sm.quantity_after,
        sm.reference_type, sm.reference_id, sm.unit_cost, sm.notes,
        sm.created_by, CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        sm.created_at
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
      ORDER BY sm.created_at DESC
      LIMIT 10
    `);

    return {
      totalProducts: parseInt(stats.total_products || "0"),
      totalStockValue: parseFloat(stats.total_stock_value || "0"),
      lowStockCount: parseInt(stats.low_stock_count || "0"),
      outOfStockCount: parseInt(stats.out_of_stock_count || "0"),
      recentMovements: movementsResult.rows.map((row: StockMovementRow) => mapStockMovementRow(row)),
    };
  } finally {
    client.release();
  }
}

/**
 * Get stock movements with pagination and filters
 */
export async function getMovements(options: StockMovementListOptions = {}): Promise<{
  movements: StockMovement[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    page = 1,
    limit = 20,
    productId,
    movementType,
    startDate,
    endDate,
    sortOrder = "desc",
  } = options;

  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  let paramIndex = 1;

  const conditions: string[] = [];

  if (productId) {
    conditions.push(`sm.product_id = $${paramIndex++}`);
    params.push(productId);
  }

  if (movementType) {
    conditions.push(`sm.movement_type = $${paramIndex++}`);
    params.push(movementType);
  }

  if (startDate) {
    conditions.push(`sm.created_at >= $${paramIndex++}`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`sm.created_at <= $${paramIndex++}`);
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const safeOrder = sortOrder === "asc" ? "ASC" : "DESC";

  const client = await pool.connect();
  try {
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM stock_movements sm ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await client.query(
      `SELECT 
        sm.id, sm.product_id, p.name as product_name, p.sku as product_sku,
        sm.variant_id, sm.movement_type, sm.quantity, sm.quantity_before, sm.quantity_after,
        sm.reference_type, sm.reference_id, sm.unit_cost, sm.notes,
        sm.created_by, CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        sm.created_at
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
      ${whereClause}
      ORDER BY sm.created_at ${safeOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      movements: result.rows.map((row: StockMovementRow) => mapStockMovementRow(row)),
      total,
      page,
      limit,
    };
  } finally {
    client.release();
  }
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(): Promise<{
  id: string;
  sku: string;
  name: string;
  categoryName: string | null;
  currentStock: number;
  lowStockThreshold: number;
  costPrice: number;
  sellingPrice: number;
}[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        p.id, p.sku, p.name, c.name as category_name,
        p.current_stock, p.low_stock_threshold, p.cost_price, p.selling_price
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL 
        AND p.status = 'active'
        AND p.track_inventory = true 
        AND p.current_stock <= p.low_stock_threshold
      ORDER BY p.current_stock ASC
    `);

    return result.rows.map((row: any) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      categoryName: row.category_name,
      currentStock: row.current_stock,
      lowStockThreshold: row.low_stock_threshold,
      costPrice: parseFloat(row.cost_price),
      sellingPrice: parseFloat(row.selling_price),
    }));
  } finally {
    client.release();
  }
}

/**
 * Bulk stock adjustment
 */
export async function bulkAdjustStock(
  adjustments: { productId: string; quantity: number; notes?: string }[],
  movementType: "purchase" | "adjustment" | "count" | "damage",
  createdBy?: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  const client = await pool.connect();
  const errors: string[] = [];
  let success = 0;

  try {
    await client.query("BEGIN");

    for (const adj of adjustments) {
      try {
        const productResult = await client.query(
          "SELECT id, name, current_stock, track_inventory FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
          [adj.productId]
        );

        if (productResult.rows.length === 0) {
          errors.push(`Product ${adj.productId} not found`);
          continue;
        }

        const product = productResult.rows[0];
        if (!product.track_inventory) {
          errors.push(`Product ${product.name} does not track inventory`);
          continue;
        }

        const currentStock = product.current_stock;
        const newStock = currentStock + adj.quantity;

        if (newStock < 0) {
          errors.push(`Product ${product.name}: Insufficient stock (current: ${currentStock}, adjustment: ${adj.quantity})`);
          continue;
        }

        await client.query(
          "UPDATE products SET current_stock = $1 WHERE id = $2",
          [newStock, adj.productId]
        );

        await client.query(
          `INSERT INTO stock_movements (
            product_id, movement_type, quantity, quantity_before, quantity_after,
            reference_type, notes, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [adj.productId, movementType, adj.quantity, currentStock, newStock, "bulk", adj.notes || null, createdBy || null]
        );

        success++;
      } catch (error: any) {
        errors.push(`Product ${adj.productId}: ${error.message}`);
      }
    }

    await client.query("COMMIT");
    return { success, failed: errors.length, errors };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Stock count - set exact quantities
 */
export async function stockCount(
  counts: { productId: string; actualCount: number; notes?: string }[],
  createdBy?: string
): Promise<{ success: number; failed: number; discrepancies: { productId: string; productName: string; expected: number; actual: number; difference: number }[] }> {
  const client = await pool.connect();
  const discrepancies: { productId: string; productName: string; expected: number; actual: number; difference: number }[] = [];
  let success = 0;
  let failed = 0;

  try {
    await client.query("BEGIN");

    for (const count of counts) {
      try {
        const productResult = await client.query(
          "SELECT id, name, current_stock, track_inventory FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
          [count.productId]
        );

        if (productResult.rows.length === 0) {
          failed++;
          continue;
        }

        const product = productResult.rows[0];
        const currentStock = product.current_stock;
        const difference = count.actualCount - currentStock;

        if (difference !== 0) {
          discrepancies.push({
            productId: product.id,
            productName: product.name,
            expected: currentStock,
            actual: count.actualCount,
            difference,
          });
        }

        await client.query(
          "UPDATE products SET current_stock = $1 WHERE id = $2",
          [count.actualCount, count.productId]
        );

        await client.query(
          `INSERT INTO stock_movements (
            product_id, movement_type, quantity, quantity_before, quantity_after,
            reference_type, notes, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [count.productId, "count", difference, currentStock, count.actualCount, "stock_count", count.notes || "Stock count adjustment", createdBy || null]
        );

        success++;
      } catch (error) {
        failed++;
      }
    }

    await client.query("COMMIT");
    return { success, failed, discrepancies };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
