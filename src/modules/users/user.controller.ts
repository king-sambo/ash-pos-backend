/**
 * User Controller
 * Handles HTTP requests for user management
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from "../../shared/utils/response";
import { BadRequestError } from "../../shared/errors/AppError";
import * as userService from "./user.service";

/**
 * GET /users
 * Get all users with pagination and filters
 */
export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      page = "1",
      limit = "10",
      search,
      roleId,
      status,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await userService.getAll({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      search: search as string,
      roleId: roleId as string,
      status: status as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
    });

    sendPaginated(res, result.users, result.page, result.limit, result.total);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /users/:id
 * Get user by ID
 */
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = await userService.getById(id);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /users
 * Create a new user
 */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      roleId,
      status,
      canAuthorizeVoid,
      canAuthorizeRefund,
    } = req.body;

    // Validation
    if (!username || !email || !password || !firstName || !lastName || !roleId) {
      throw new BadRequestError(
        "Username, email, password, first name, last name, and role are required"
      );
    }

    const user = await userService.create({
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      roleId,
      status,
      canAuthorizeVoid,
      canAuthorizeRefund,
      createdBy: req.user?.userId,
    });

    sendCreated(res, user, "User created successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /users/:id
 * Update a user
 */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const {
      username,
      email,
      firstName,
      lastName,
      phone,
      roleId,
      status,
      canAuthorizeVoid,
      canAuthorizeRefund,
      avatarUrl,
    } = req.body;

    const user = await userService.update(id, {
      username,
      email,
      firstName,
      lastName,
      phone,
      roleId,
      status,
      canAuthorizeVoid,
      canAuthorizeRefund,
      avatarUrl,
    });

    sendSuccess(res, user, "User updated successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /users/:id
 * Soft delete a user
 */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await userService.remove(id, req.user?.userId);
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /users/me
 * Get current user profile
 */
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestError("User not authenticated");
    }
    const user = await userService.getById(userId);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /users/roles
 * Get all available roles
 */
export async function getRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await userService.getRoles();
    sendSuccess(res, roles);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /users/:id/reset-password
 * Reset user password (admin action)
 */
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      throw new BadRequestError("New password is required");
    }

    await userService.resetPassword(id, newPassword);
    sendSuccess(res, null, "Password reset successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * POST /users/:id/unlock
 * Unlock a locked user account
 */
export async function unlockAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await userService.unlockAccount(id);
    sendSuccess(res, null, "Account unlocked successfully");
  } catch (error) {
    next(error);
  }
}