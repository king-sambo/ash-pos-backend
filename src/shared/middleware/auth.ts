import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { config } from "../../config/env";
import { UnauthorizedError, ForbiddenError } from "../errors/AppError";

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export interface AuthPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  roleId: string;
  permissions: string[];
  canAuthorizeVoid?: boolean;
  canAuthorizeRefund?: boolean;
}

// Type alias for Express Request with user property
export interface AuthRequest extends Request {
  user?: AuthPayload;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("No token provided");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthPayload;

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError("Invalid token"));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError("Token expired"));
    } else {
      next(error);
    }
  }
}

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError("Not authenticated"));
    }

    const userRole = req.user.role.toLowerCase();
    const allowed = allowedRoles.map((r) => r.toLowerCase());

    if (!allowed.includes(userRole)) {
      return next(
        new ForbiddenError("Access denied. Required role: " + allowedRoles.join(" or "))
      );
    }

    next();
  };
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError("Not authenticated"));
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.some((perm) =>
      userPermissions.includes(perm)
    );

    if (!hasPermission) {
      return next(
        new ForbiddenError("Permission denied. Required: " + requiredPermissions.join(" or "))
      );
    }

    next();
  };
}

export async function verifyActiveUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    return next(new UnauthorizedError("Not authenticated"));
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT status FROM users WHERE id = $1 AND deleted_at IS NULL",
      [req.user.userId]
    );

    const user = result.rows[0];
    if (!user || user.status !== "active") {
      return next(new ForbiddenError("Account is not active"));
    }

    next();
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, config.JWT_SECRET) as AuthPayload;
      req.user = decoded;
    }
    next();
  } catch {
    next();
  }
}

export function hasPermission(req: Request, permission: string): boolean {
  return req.user?.permissions?.includes(permission) || false;
}

export function isSuperAdmin(req: Request): boolean {
  return req.user?.role.toLowerCase() === "super_admin";
}

export function isManagerOrAbove(req: Request): boolean {
  const role = req.user?.role.toLowerCase();
  return role === "super_admin" || role === "manager";
}
