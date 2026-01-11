import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { config } from "../../config/env";
import {
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
} from "../../shared/errors/AppError";

// Database pool
const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Types
export interface UserPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  roleId: string;
  permissions: string[];
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    permissions: string[];
    canAuthorizeVoid: boolean;
    canAuthorizeRefund: boolean;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  roleId: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

/**
 * User login
 */
export async function login(
  emailOrUsername: string,
  password: string
): Promise<LoginResult> {
  const client = await pool.connect();

  try {
    // Fetch user with role and permissions
    const userQuery = await client.query(
      `SELECT 
        u.id,
        u.username,
        u.email,
        u.password_hash,
        u.first_name,
        u.last_name,
        u.status,
        u.failed_login_attempts,
        u.locked_until,
        u.can_authorize_void,
        u.can_authorize_refund,
        u.role_id,
        r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE (LOWER(u.email) = LOWER($1) OR LOWER(u.username) = LOWER($1))
      AND u.deleted_at IS NULL`,
      [emailOrUsername]
    );

    const user = userQuery.rows[0];

    if (!user) {
      throw new UnauthorizedError("Invalid email/username or password");
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(user.locked_until).getTime() - Date.now()) / 60000
      );
      throw new UnauthorizedError(
        `Account is locked. Try again in ${remainingMinutes} minute(s).`
      );
    }

    // Check if user is active
    if (user.status !== "active") {
      throw new UnauthorizedError(
        `Account is ${user.status}. Please contact administrator.`
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Increment failed login attempts
      const attempts = (user.failed_login_attempts || 0) + 1;
      let lockUntil = null;

      if (attempts >= config.MAX_LOGIN_ATTEMPTS) {
        lockUntil = new Date(
          Date.now() + config.LOCKOUT_DURATION_MINUTES * 60 * 1000
        );
      }

      await client.query(
        `UPDATE users SET 
          failed_login_attempts = $1,
          locked_until = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
        [attempts, lockUntil, user.id]
      );

      if (lockUntil) {
        throw new UnauthorizedError(
          `Too many failed attempts. Account locked for ${config.LOCKOUT_DURATION_MINUTES} minutes.`
        );
      }

      throw new UnauthorizedError("Invalid email/username or password");
    }

    // Get user permissions
    const permissionsQuery = await client.query(
      `SELECT p.name 
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1`,
      [user.role_id]
    );
    const permissions = permissionsQuery.rows.map((p) => p.name);

    // Reset failed login attempts and update last login
    await client.query(
      `UPDATE users SET 
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
      [user.id]
    );

    // Generate tokens
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role_name,
      roleId: user.role_id,
      permissions,
    };

    // Use expiresIn with numeric seconds for type safety
    const accessTokenExpiresIn = parseExpiry(config.JWT_EXPIRES_IN);
    const accessToken = jwt.sign(payload, config.JWT_SECRET, { 
      expiresIn: accessTokenExpiresIn 
    });

    const refreshTokenExpiresIn = parseExpiry(config.JWT_REFRESH_EXPIRES_IN);
    const newRefreshToken = jwt.sign(
      { userId: user.id, type: "refresh" },
      config.JWT_REFRESH_SECRET,
      { expiresIn: refreshTokenExpiresIn }
    );

    // Store session
    const tokenHash = await bcrypt.hash(newRefreshToken.slice(-20), 10);
    await client.query(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, tokenHash]
    );

    // Parse expiry for response
    const expiresIn = parseExpiry(config.JWT_EXPIRES_IN);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name,
        permissions,
        canAuthorizeVoid: user.can_authorize_void,
        canAuthorizeRefund: user.can_authorize_refund,
      },
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    };
  } finally {
    client.release();
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(
  token: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const client = await pool.connect();

  try {
    // Verify refresh token
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET) as {
      userId: string;
      type: string;
    };

    if (decoded.type !== "refresh") {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Fetch user with role
    const userQuery = await client.query(
      `SELECT 
        u.id, u.email, u.username, u.status, u.role_id,
        r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [decoded.userId]
    );

    const user = userQuery.rows[0];

    if (!user || user.status !== "active") {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Get permissions
    const permissionsQuery = await client.query(
      `SELECT p.name FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1`,
      [user.role_id]
    );
    const permissions = permissionsQuery.rows.map((p) => p.name);

    // Generate new access token
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role_name,
      roleId: user.role_id,
      permissions,
    };

    const tokenExpiresIn = parseExpiry(config.JWT_EXPIRES_IN);
    const accessToken = jwt.sign(payload, config.JWT_SECRET, { 
      expiresIn: tokenExpiresIn 
    });

    return {
      accessToken,
      expiresIn: tokenExpiresIn,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Refresh token expired. Please login again.");
    }
    throw new UnauthorizedError("Invalid refresh token");
  } finally {
    client.release();
  }
}

/**
 * Logout - invalidate session
 */
export async function logout(userId: string, token?: string): Promise<void> {
  const client = await pool.connect();

  try {
    if (token) {
      // Invalidate specific session
      const tokenHash = await bcrypt.hash(token.slice(-20), 10);
      await client.query(
        `DELETE FROM user_sessions WHERE user_id = $1 AND token_hash = $2`,
        [userId, tokenHash]
      );
    } else {
      // Invalidate all sessions for user
      await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [
        userId,
      ]);
    }
  } finally {
    client.release();
  }
}

/**
 * Change password
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const client = await pool.connect();

  try {
    // Fetch current password
    const userQuery = await client.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId]
    );

    const user = userQuery.rows[0];
    if (!user) {
      throw new BadRequestError("User not found");
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new BadRequestError("Current password is incorrect");
    }

    // Validate new password
    if (newPassword.length < config.PASSWORD_MIN_LENGTH) {
      throw new BadRequestError(
        `Password must be at least ${config.PASSWORD_MIN_LENGTH} characters`
      );
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await client.query(
      `UPDATE users SET 
        password_hash = $1,
        password_changed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2`,
      [hashedPassword, userId]
    );

    // Invalidate all sessions (force re-login)
    await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [
      userId,
    ]);
  } finally {
    client.release();
  }
}

/**
 * Verify supervisor PIN for void/refund authorization
 */
export async function verifySupervisorPin(
  supervisorId: string,
  pin: string,
  action: "void" | "refund"
): Promise<{ valid: boolean; supervisorName: string }> {
  const client = await pool.connect();

  try {
    const userQuery = await client.query(
      `SELECT 
        id, first_name, last_name, supervisor_pin,
        can_authorize_void, can_authorize_refund, status
      FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [supervisorId]
    );

    const supervisor = userQuery.rows[0];

    if (!supervisor) {
      throw new BadRequestError("Supervisor not found");
    }

    if (supervisor.status !== "active") {
      throw new ForbiddenError("Supervisor account is not active");
    }

    if (!supervisor.supervisor_pin) {
      throw new ForbiddenError("Supervisor has not set up a PIN");
    }

    // Check authorization permission
    if (action === "void" && !supervisor.can_authorize_void) {
      throw new ForbiddenError(
        "This user is not authorized to approve void transactions"
      );
    }

    if (action === "refund" && !supervisor.can_authorize_refund) {
      throw new ForbiddenError(
        "This user is not authorized to approve refunds"
      );
    }

    // Verify PIN
    const isValidPin = await bcrypt.compare(pin, supervisor.supervisor_pin);

    if (!isValidPin) {
      throw new UnauthorizedError("Invalid supervisor PIN");
    }

    return {
      valid: true,
      supervisorName: `${supervisor.first_name} ${supervisor.last_name}`,
    };
  } finally {
    client.release();
  }
}

/**
 * Get current user profile
 */
export async function getProfile(userId: string) {
  const client = await pool.connect();

  try {
    const userQuery = await client.query(
      `SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name,
        u.phone, u.avatar_url, u.status, u.last_login_at,
        u.can_authorize_void, u.can_authorize_refund,
        u.created_at, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );

    const user = userQuery.rows[0];

    if (!user) {
      throw new BadRequestError("User not found");
    }

    // Get permissions
    const permissionsQuery = await client.query(
      `SELECT p.name FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN users u ON u.role_id = rp.role_id
      WHERE u.id = $1`,
      [userId]
    );
    const permissions = permissionsQuery.rows.map((p) => p.name);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      role: user.role_name,
      permissions,
      status: user.status,
      canAuthorizeVoid: user.can_authorize_void,
      canAuthorizeRefund: user.can_authorize_refund,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
    };
  } finally {
    client.release();
  }
}

/**
 * Set supervisor PIN
 */
export async function setSupervisorPin(
  userId: string,
  currentPassword: string,
  pin: string
): Promise<void> {
  const client = await pool.connect();

  try {
    // Verify current password first
    const userQuery = await client.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId]
    );

    const user = userQuery.rows[0];
    if (!user) {
      throw new BadRequestError("User not found");
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new BadRequestError("Password is incorrect");
    }

    // Validate PIN (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestError("PIN must be 4-6 digits");
    }

    // Hash and save PIN
    const hashedPin = await bcrypt.hash(pin, 10);
    await client.query(
      `UPDATE users SET supervisor_pin = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [hashedPin, userId]
    );
  } finally {
    client.release();
  }
}

// Helper function to parse JWT expiry string to seconds
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 3600; // Default 1 hour

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return 3600;
  }
}
