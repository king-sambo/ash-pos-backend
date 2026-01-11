/**
 * Category Service
 */

import { pool } from "../../config/database";
import { NotFoundError, BadRequestError, ConflictError } from "../../shared/errors/AppError";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryData {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  parent_name: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: string;
  created_at: string;
  updated_at: string;
}

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parent_id,
    parentName: row.parent_name,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    productCount: parseInt(row.product_count || "0"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all categories
 */
export async function getAll(includeInactive: boolean = false): Promise<Category[]> {
  const client = await pool.connect();
  try {
    const conditions = includeInactive ? "" : "WHERE c.is_active = true";
    
    const result = await client.query(
      `SELECT 
        c.id, c.name, c.slug, c.description, c.parent_id,
        p.name as parent_name,
        c.image_url, c.sort_order, c.is_active, c.created_at, c.updated_at,
        COUNT(pr.id) as product_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      LEFT JOIN products pr ON pr.category_id = c.id AND pr.deleted_at IS NULL
      ${conditions}
      GROUP BY c.id, p.name
      ORDER BY c.sort_order ASC, c.name ASC`
    );

    return result.rows.map((row: CategoryRow) => mapCategoryRow(row));
  } finally {
    client.release();
  }
}

/**
 * Get category by ID
 */
export async function getById(id: string): Promise<Category> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        c.id, c.name, c.slug, c.description, c.parent_id,
        p.name as parent_name,
        c.image_url, c.sort_order, c.is_active, c.created_at, c.updated_at,
        COUNT(pr.id) as product_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      LEFT JOIN products pr ON pr.category_id = c.id AND pr.deleted_at IS NULL
      WHERE c.id = $1
      GROUP BY c.id, p.name`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Category not found");
    }

    return mapCategoryRow(result.rows[0] as CategoryRow);
  } finally {
    client.release();
  }
}

/**
 * Create a new category
 */
export async function create(data: CreateCategoryData): Promise<Category> {
  const client = await pool.connect();
  try {
    const slug = data.slug || generateSlug(data.name);

    // Check slug uniqueness
    const slugCheck = await client.query(
      "SELECT id FROM categories WHERE slug = $1",
      [slug]
    );
    if (slugCheck.rows.length > 0) {
      throw new ConflictError("Category slug already exists");
    }

    const result = await client.query(
      `INSERT INTO categories (name, slug, description, parent_id, image_url, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        data.name,
        slug,
        data.description || null,
        data.parentId || null,
        data.imageUrl || null,
        data.sortOrder ?? 0,
        data.isActive ?? true,
      ]
    );

    return getById(result.rows[0].id);
  } finally {
    client.release();
  }
}

/**
 * Update a category
 */
export async function update(id: string, data: UpdateCategoryData): Promise<Category> {
  const client = await pool.connect();
  try {
    const existingCategory = await client.query(
      "SELECT id FROM categories WHERE id = $1",
      [id]
    );
    if (existingCategory.rows.length === 0) {
      throw new NotFoundError("Category not found");
    }

    // Check slug uniqueness if updating
    if (data.slug) {
      const slugCheck = await client.query(
        "SELECT id FROM categories WHERE slug = $1 AND id != $2",
        [data.slug, id]
      );
      if (slugCheck.rows.length > 0) {
        throw new ConflictError("Category slug already exists");
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, string> = {
      name: "name",
      slug: "slug",
      description: "description",
      parentId: "parent_id",
      imageUrl: "image_url",
      sortOrder: "sort_order",
      isActive: "is_active",
    };

    for (const [key, column] of Object.entries(fieldMappings)) {
      if (data[key as keyof UpdateCategoryData] !== undefined) {
        updates.push(`${column} = $${paramIndex++}`);
        params.push(data[key as keyof UpdateCategoryData]);
      }
    }

    if (updates.length === 0) {
      throw new BadRequestError("No fields to update");
    }

    params.push(id);
    await client.query(
      `UPDATE categories SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    return getById(id);
  } finally {
    client.release();
  }
}

/**
 * Delete a category
 */
export async function remove(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Check for products in category
    const productCheck = await client.query(
      "SELECT COUNT(*) as count FROM products WHERE category_id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (parseInt(productCheck.rows[0].count) > 0) {
      throw new BadRequestError("Cannot delete category with products. Move or delete products first.");
    }

    // Check for subcategories
    const subCheck = await client.query(
      "SELECT COUNT(*) as count FROM categories WHERE parent_id = $1",
      [id]
    );
    if (parseInt(subCheck.rows[0].count) > 0) {
      throw new BadRequestError("Cannot delete category with subcategories.");
    }

    const result = await client.query(
      "DELETE FROM categories WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Category not found");
    }
  } finally {
    client.release();
  }
}
