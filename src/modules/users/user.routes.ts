/**
 * User Routes
 */

import { Router } from "express";
import * as userController from "./user.controller";
import { authenticate, authorize, requirePermission } from "../../shared/middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/users/roles
 * @desc    Get all available roles
 * @access  Private (users.view)
 */
router.get("/roles", requirePermission("users.view"), userController.getRoles);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with pagination
 * @access  Private (users.view)
 */
router.get("/", requirePermission("users.view"), userController.getAll);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private (users.view)
 */
router.get("/:id", requirePermission("users.view"), userController.getById);

/**
 * @route   POST /api/v1/users
 * @desc    Create new user
 * @access  Private (users.create)
 */
router.post("/", requirePermission("users.create"), userController.create);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user
 * @access  Private (users.edit)
 */
router.put("/:id", requirePermission("users.edit"), userController.update);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user (soft delete)
 * @access  Private (users.delete)
 */
router.delete("/:id", requirePermission("users.delete"), userController.remove);

/**
 * @route   POST /api/v1/users/:id/reset-password
 * @desc    Reset user password
 * @access  Private (users.edit)
 */
router.post("/:id/reset-password", requirePermission("users.edit"), userController.resetPassword);

/**
 * @route   POST /api/v1/users/:id/unlock
 * @desc    Unlock locked user account
 * @access  Private (users.edit)
 */
router.post("/:id/unlock", requirePermission("users.edit"), userController.unlockAccount);

export default router;
