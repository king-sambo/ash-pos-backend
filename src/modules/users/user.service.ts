/**
 * User Service
 * Handles all user-related business logic
 */

import bcrypt from "bcryptjs";
import { pool } from "../../config/database";
import { NotFoundError, BadRequestError, ConflictError } from "../../shared/errors/AppError";
import { config } from "../../config/env";

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string;
  roleName: string;
  status: "active" | "inactive" | "suspended";
  canAuthorizeVoid: boolean;
  canAuthorizeRefund: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: string;
  status?: "active" | "inactive" | "suspended";
  canAuthorizeVoid?: boolean;
  canAuthorizeRefund?: boolean;
  createdBy?: string;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  roleId?: string;
  status?: "active" | "inactive" | "suspended";
  canAuthorizeVoid?: boolean;
  canAuthorizeRefund?: boolean;
  avatarUrl?: string;
}

export interface UserListOptions {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface UserRow {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  role_id: string;
  role_name: string;
  status: string;
  can_authorize_void: boolean;
  can_authorize_refund: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    roleId: row.role_id,
    roleName: row.role_name,
    status: row.status as User["status"],
    canAuthorizeVoid: row.can_authorize_void,
    canAuthorizeRefund: row.can_authorize_refund,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all users with pagination and filters
 */
export async function getAll(options: UserListOptions = {}): Promise<{
  users: User[];
  total: number;
  page: number;
  limit: number;
}> {
  const {
    page = 1,
    limit = 10,
    search,
    roleId,
    status,
    sortBy = "created_at",
    sortOrder = "desc",
  } = options;

  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  let paramIndex = 1;

  // Build WHERE clause
  const conditions: string[] = ["u.deleted_at IS NULL"];

  if (search) {
    conditions.push(`(
      u.username ILIKE $${paramIndex} OR 
      u.email ILIKE $${paramIndex} OR 
      u.first_name ILIKE $${paramIndex} OR 
      u.last_name ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (roleId) {
    conditions.push(`u.role_id = $${paramIndex}`);
    params.push(roleId);
    paramIndex++;
  }

  if (status) {
    conditions.push(`u.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Validate sort column
  const allowedSortColumns = ["username", "email", "first_name", "last_name", "status", "created_at", "last_login_at"];
  const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : "created_at";
  const safeOrder = sortOrder === "asc" ? "ASC" : "DESC";

  const client = await pool.connect();
  try {
    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get users
    const result = await client.query(
      `SELECT 
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.avatar_url,
        u.role_id,
        r.name as role_name,
        u.status,
        u.can_authorize_void,
        u.can_authorize_refund,
        u.last_login_at,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY u.${safeSort} ${safeOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      users: result.rows.map((row: UserRow) => mapUserRow(row)),
      total,
      page,
      limit,
    };
  } finally {
    client.release();
  }
}

/**
 * Get user by ID
 */
export async function getById(id: string): Promise<User> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.avatar_url,
        u.role_id,
        r.name as role_name,
        u.status,
        u.can_authorize_void,
        u.can_authorize_refund,
        u.last_login_at,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("User not found");
    }

    return mapUserRow(result.rows[0] as UserRow);
  } finally {
    client.release();
  }
}

/**
 * Create a new user
 */
export async function create(data: CreateUserData): Promise<User> {
  const client = await pool.connect();
  try {
    // Check if username already exists
    const usernameCheck = await client.query(
      "SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL",
      [data.username]
    );
    if (usernameCheck.rows.length > 0) {
      throw new ConflictError("Username already exists");
    }

    // Check if email already exists
    const emailCheck = await client.query(
      "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
      [data.email]
    );
    if (emailCheck.rows.length > 0) {
      throw new ConflictError("Email already exists");
    }

    // Verify role exists
    const roleCheck = await client.query(
      "SELECT id FROM roles WHERE id = $1",
      [data.roleId]
    );
    if (roleCheck.rows.length === 0) {
      throw new BadRequestError("Invalid role ID");
    }

    // Validate password
    if (data.password.length < config.PASSWORD_MIN_LENGTH) {
      throw new BadRequestError(`Password must be at least ${config.PASSWORD_MIN_LENGTH} characters`);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Insert user
    const result = await client.query(
      `INSERT INTO users (
        username, email, password_hash, first_name, last_name, 
        phone, role_id, status, can_authorize_void, can_authorize_refund, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        data.username,
        data.email,
        passwordHash,
        data.firstName,
        data.lastName,
        data.phone || null,
        data.roleId,
        data.status || "active",
        data.canAuthorizeVoid || false,
        data.canAuthorizeRefund || false,
        data.createdBy || null,
      ]
    );

    return getById(result.rows[0].id);
  } finally {
    client.release();
  }
}

/**
 * Update a user
 */
export async function update(id: string, data: UpdateUserData): Promise<User> {
  const client = await pool.connect();
  try {
    // Check if user exists
    const existingUser = await client.query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (existingUser.rows.length === 0) {
      throw new NotFoundError("User not found");
    }

    // Check username uniqueness if updating
    if (data.username) {
      const usernameCheck = await client.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2 AND deleted_at IS NULL",
        [data.username, id]
      );
      if (usernameCheck.rows.length > 0) {
        throw new ConflictError("Username already exists");
      }
    }

    // Check email uniqueness if updating
    if (data.email) {
      const emailCheck = await client.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL",
        [data.email, id]
      );
      if (emailCheck.rows.length > 0) {
        throw new ConflictError("Email already exists");
      }
    }

    // Verify role if updating
    if (data.roleId) {
      const roleCheck = await client.query(
        "SELECT id FROM roles WHERE id = $1",
        [data.roleId]
      );
      if (roleCheck.rows.length === 0) {
        throw new BadRequestError("Invalid role ID");
      }
    }

    // Build update query
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.username !== undefined) {
      updates.push(`username = $${paramIndex++}`);
      params.push(data.username);
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(data.email);
    }
    if (data.firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      params.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      params.push(data.lastName);
    }
    if (data.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(data.phone);
    }
    if (data.roleId !== undefined) {
      updates.push(`role_id = $${paramIndex++}`);
      params.push(data.roleId);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.canAuthorizeVoid !== undefined) {
      updates.push(`can_authorize_void = $${paramIndex++}`);
      params.push(data.canAuthorizeVoid);
    }
    if (data.canAuthorizeRefund !== undefined) {
      updates.push(`can_authorize_refund = $${paramIndex++}`);
      params.push(data.canAuthorizeRefund);
    }
    if (data.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      params.push(data.avatarUrl);
    }

    if (updates.length === 0) {
      throw new BadRequestError("No fields to update");
    }

    params.push(id);
    await client.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    return getById(id);
  } finally {
    client.release();
  }
}

/**
 * Soft delete a user
 */
export async function remove(id: string, deletedBy?: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if user exists
    const existingUser = await client.query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (existingUser.rows.length === 0) {
      throw new NotFoundError("User not found");
    }

    // Prevent self-deletion
    if (deletedBy && id === deletedBy) {
      throw new BadRequestError("Cannot delete your own account");
    }

    // Soft delete
    await client.query(
      "UPDATE users SET deleted_at = NOW(), status = 'inactive' WHERE id = $1",
      [id]
    );
  } finally {
    client.release();
  }
}

/**
 * Reset user password (admin action)
 */
export async function resetPassword(id: string, newPassword: string): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if user exists
    const existingUser = await client.query(
      "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (existingUser.rows.length === 0) {
      throw new NotFoundError("User not found");
    }

    // Validate password
    if (newPassword.length < config.PASSWORD_MIN_LENGTH) {
      throw new BadRequestError(`Password must be at least ${config.PASSWORD_MIN_LENGTH} characters`);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await client.query(
      "UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2",
      [passwordHash, id]
    );
  } finally {
    client.release();
  }
}

/**
 * Get all roles
 */
export async function getRoles(): Promise<{ id: string; name: string; description: string }[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, name, description FROM roles ORDER BY name`
    );
    return result.rows.map((row: { id: string; name: string; description: string }) => ({
      id: row.id,
      name: row.name,
      description: row.description,
    }));
  } finally {
    client.release();
  }
}

/**
 * Unlock a locked user account
 */
export async function unlockAccount(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE users SET 
        failed_login_attempts = 0, 
        locked_until = NULL 
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("User not found");
    }
  } finally {
    client.release();
  }
}
