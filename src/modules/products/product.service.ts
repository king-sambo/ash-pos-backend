/**
 * Product Service
 * Handles all product-related business logic
 */

import { pool } from "../../config/database";
import { NotFoundError, BadRequestError, ConflictError } from "../../shared/errors/AppError";

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  costPrice: number;
  sellingPrice: number;
  compareAtPrice: number | null;
  isTaxable: boolean;
  taxRate: number;
  isVatExemptEligible: boolean;
  trackInventory: boolean;
  currentStock: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
  unit: string;
  unitValue: number;
  imageUrl: string | null;
  images: string[] | null;
  isDiscountable: boolean;
  excludeFromPromotions: boolean;
  excludeFromMembershipDiscount: boolean;
  status: "active" | "inactive" | "draft" | "archived";
  tags: string[] | null;
  attributes: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductData {
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: string;
  costPrice: number;
  sellingPrice: number;
  compareAtPrice?: number;
  isTaxable?: boolean;
  taxRate?: number;
  isVatExemptEligible?: boolean;
  trackInventory?: boolean;
  currentStock?: number;
  lowStockThreshold?: number;
  allowBackorder?: boolean;
  unit?: string;
  unitValue?: number;
  imageUrl?: string;
  images?: string[];
  isDiscountable?: boolean;
  excludeFromPromotions?: boolean;
  excludeFromMembershipDiscount?: boolean;
  status?: "active" | "inactive" | "draft" | "archived";
  tags?: string[];
  attributes?: Record<string, string>;
  createdBy?: string;
}

export interface UpdateProductData extends Partial<CreateProductData> {}

export interface ProductListOptions {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  lowStock?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface ProductRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  cost_price: string;
  selling_price: string;
  compare_at_price: string | null;
  is_taxable: boolean;
  tax_rate: string;
  is_vat_exempt_eligible: boolean;
  track_inventory: boolean;
  current_stock: number;
  low_stock_threshold: number;
  allow_backorder: boolean;
  unit: string;
  unit_value: string;
  image_url: string | null;
  images: string[] | null;
  is_discountable: boolean;
  exclude_from_promotions: boolean;
  exclude_from_membership_discount: boolean;
  status: "active" | "inactive" | "draft" | "archived";
  tags: string[] | null;
  attributes: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    costPrice: parseFloat(row.cost_price || "0"),
    sellingPrice: parseFloat(row.selling_price || "0"),
    compareAtPrice: row.compare_at_price ? parseFloat(row.compare_at_price) : null,
    isTaxable: row.is_taxable,
    taxRate: parseFloat(row.tax_rate || "12"),
    isVatExemptEligible: row.is_vat_exempt_eligible,
    trackInventory: row.track_inventory,
    currentStock: row.current_stock,
    lowStockThreshold: row.low_stock_threshold,
    allowBackorder: row.allow_backorder,
    unit: row.unit,
    unitValue: parseFloat(row.unit_value || "1"),
    imageUrl: row.image_url,
    images: row.images,
    isDiscountable: row.is_discountable,
    excludeFromPromotions: row.exclude_from_promotions,
    excludeFromMembershipDiscount: row.exclude_from_membership_discount,
    status: row.status,
    tags: row.tags,
    attributes: row.attributes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const productSelectFields = `
  p.id, p.sku, p.barcode, p.name, p.description, p.category_id,
  c.name as category_name,
  p.cost_price, p.selling_price, p.compare_at_price,
  p.is_taxable, p.tax_rate, p.is_vat_exempt_eligible,
  p.track_inventory, p.current_stock, p.low_stock_threshold, p.allow_backorder,
  p.unit, p.unit_value, p.image_url, p.images,
  p.is_discountable, p.exclude_from_promotions, p.exclude_from_membership_discount,
  p.status, p.tags, p.attributes, p.created_at, p.updated_at
`;

/**
 * Get all products with pagination and filters
 */
export async function getAll(options: ProductListOptions = {}): Promise<{
  products: Product[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    status,
    lowStock,
    sortBy = "created_at",
    sortOrder = "desc",
  } = options;

  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  let paramIndex = 1;

  const conditions: string[] = ["p.deleted_at IS NULL"];

  if (search) {
    conditions.push(`(p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (categoryId) {
    conditions.push(`p.category_id = $${paramIndex}`);
    params.push(categoryId);
    paramIndex++;
  }

  if (status) {
    conditions.push(`p.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (lowStock) {
    conditions.push(`p.track_inventory = true AND p.current_stock <= p.low_stock_threshold`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const allowedSortColumns = ["name", "sku", "selling_price", "current_stock", "created_at", "updated_at"];
  const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : "created_at";
  const safeOrder = sortOrder === "asc" ? "ASC" : "DESC";

  const client = await pool.connect();
  try {
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await client.query(
      `SELECT ${productSelectFields}
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.${safeSort} ${safeOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      products: result.rows.map((row: ProductRow) => mapProductRow(row)),
      total,
      page,
      limit,
    };
  } finally {
    client.release();
  }
}

/**
 * Get product by ID
 */
export async function getById(id: string): Promise<Product> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT ${productSelectFields}
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Product not found");
    }

    return mapProductRow(result.rows[0] as ProductRow);
  } finally {
    client.release();
  }
}

/**
 * Search product by SKU or barcode
 */
export async function searchByCode(code: string): Promise<Product | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT ${productSelectFields}
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL AND (p.sku = $1 OR p.barcode = $1)`,
      [code]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapProductRow(result.rows[0] as ProductRow);
  } finally {
    client.release();
  }
}

/**
 * Get low stock products
 */
export async function getLowStock(limit: number = 20): Promise<Product[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT ${productSelectFields}
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL 
        AND p.track_inventory = true 
        AND p.current_stock <= p.low_stock_threshold
        AND p.status = 'active'
      ORDER BY p.current_stock ASC
      LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: ProductRow) => mapProductRow(row));
  } finally {
    client.release();
  }
}

/**
 * Create a new product
 */
export async function create(data: CreateProductData): Promise<Product> {
  const client = await pool.connect();
  try {
    // Check SKU uniqueness if provided
    if (data.sku) {
      const skuCheck = await client.query(
        "SELECT id FROM products WHERE sku = $1 AND deleted_at IS NULL",
        [data.sku]
      );
      if (skuCheck.rows.length > 0) {
        throw new ConflictError("SKU already exists");
      }
    }

    // Check barcode uniqueness if provided
    if (data.barcode) {
      const barcodeCheck = await client.query(
        "SELECT id FROM products WHERE barcode = $1 AND deleted_at IS NULL",
        [data.barcode]
      );
      if (barcodeCheck.rows.length > 0) {
        throw new ConflictError("Barcode already exists");
      }
    }

    const result = await client.query(
      `INSERT INTO products (
        name, description, category_id, cost_price, selling_price, compare_at_price,
        is_taxable, tax_rate, is_vat_exempt_eligible, track_inventory, current_stock,
        low_stock_threshold, allow_backorder, unit, unit_value, image_url, images,
        is_discountable, exclude_from_promotions, exclude_from_membership_discount,
        status, tags, attributes, barcode, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING id`,
      [
        data.name,
        data.description || null,
        data.categoryId || null,
        data.costPrice,
        data.sellingPrice,
        data.compareAtPrice || null,
        data.isTaxable ?? true,
        data.taxRate ?? 12,
        data.isVatExemptEligible ?? true,
        data.trackInventory ?? true,
        data.currentStock ?? 0,
        data.lowStockThreshold ?? 10,
        data.allowBackorder ?? false,
        data.unit ?? "piece",
        data.unitValue ?? 1,
        data.imageUrl || null,
        data.images ? JSON.stringify(data.images) : null,
        data.isDiscountable ?? true,
        data.excludeFromPromotions ?? false,
        data.excludeFromMembershipDiscount ?? false,
        data.status ?? "active",
        data.tags ? JSON.stringify(data.tags) : null,
        data.attributes ? JSON.stringify(data.attributes) : null,
        data.barcode || null,
        data.createdBy || null,
      ]
    );

    return getById(result.rows[0].id);
  } finally {
    client.release();
  }
}

/**
 * Update a product
 */
export async function update(id: string, data: UpdateProductData): Promise<Product> {
  const client = await pool.connect();
  try {
    const existingProduct = await client.query(
      "SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (existingProduct.rows.length === 0) {
      throw new NotFoundError("Product not found");
    }

    // Check SKU uniqueness if updating
    if (data.sku) {
      const skuCheck = await client.query(
        "SELECT id FROM products WHERE sku = $1 AND id != $2 AND deleted_at IS NULL",
        [data.sku, id]
      );
      if (skuCheck.rows.length > 0) {
        throw new ConflictError("SKU already exists");
      }
    }

    // Check barcode uniqueness if updating
    if (data.barcode) {
      const barcodeCheck = await client.query(
        "SELECT id FROM products WHERE barcode = $1 AND id != $2 AND deleted_at IS NULL",
        [data.barcode, id]
      );
      if (barcodeCheck.rows.length > 0) {
        throw new ConflictError("Barcode already exists");
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, string> = {
      name: "name",
      description: "description",
      categoryId: "category_id",
      costPrice: "cost_price",
      sellingPrice: "selling_price",
      compareAtPrice: "compare_at_price",
      isTaxable: "is_taxable",
      taxRate: "tax_rate",
      isVatExemptEligible: "is_vat_exempt_eligible",
      trackInventory: "track_inventory",
      currentStock: "current_stock",
      lowStockThreshold: "low_stock_threshold",
      allowBackorder: "allow_backorder",
      unit: "unit",
      unitValue: "unit_value",
      imageUrl: "image_url",
      isDiscountable: "is_discountable",
      excludeFromPromotions: "exclude_from_promotions",
      excludeFromMembershipDiscount: "exclude_from_membership_discount",
      status: "status",
      barcode: "barcode",
      sku: "sku",
    };

    for (const [key, column] of Object.entries(fieldMappings)) {
      if (data[key as keyof UpdateProductData] !== undefined) {
        updates.push(`${column} = $${paramIndex++}`);
        params.push(data[key as keyof UpdateProductData]);
      }
    }

    // Handle JSON fields
    if (data.images !== undefined) {
      updates.push(`images = $${paramIndex++}`);
      params.push(JSON.stringify(data.images));
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(JSON.stringify(data.tags));
    }
    if (data.attributes !== undefined) {
      updates.push(`attributes = $${paramIndex++}`);
      params.push(JSON.stringify(data.attributes));
    }

    if (updates.length === 0) {
      throw new BadRequestError("No fields to update");
    }

    params.push(id);
    await client.query(
      `UPDATE products SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    return getById(id);
  } finally {
    client.release();
  }
}

/**
 * Soft delete a product
 */
export async function remove(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE products SET deleted_at = NOW(), status = 'archived' 
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Product not found");
    }
  } finally {
    client.release();
  }
}

/**
 * Adjust stock
 */
export async function adjustStock(
  id: string,
  quantity: number,
  movementType: "purchase" | "adjustment" | "return" | "damage" | "count",
  notes?: string,
  createdBy?: string
): Promise<Product> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      "SELECT current_stock, track_inventory FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id]
    );

    if (productResult.rows.length === 0) {
      throw new NotFoundError("Product not found");
    }

    const currentStock = productResult.rows[0].current_stock;
    const newStock = currentStock + quantity;

    if (newStock < 0) {
      throw new BadRequestError("Insufficient stock");
    }

    // Update product stock
    await client.query(
      "UPDATE products SET current_stock = $1 WHERE id = $2",
      [newStock, id]
    );

    // Record stock movement
    await client.query(
      `INSERT INTO stock_movements (
        product_id, movement_type, quantity, quantity_before, quantity_after,
        reference_type, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, movementType, quantity, currentStock, newStock, "manual", notes || null, createdBy || null]
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
