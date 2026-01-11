import { Router } from "express";
import * as authController from "./auth.controller";
import { authenticate } from "../../shared/middleware/auth";

const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", authController.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post("/refresh", authController.refreshToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post("/logout", authenticate, authController.logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", authenticate, authController.getProfile);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post("/change-password", authenticate, authController.changePassword);

/**
 * @route   POST /api/v1/auth/verify-supervisor-pin
 * @desc    Verify supervisor PIN for void/refund
 * @access  Private
 */
router.post("/verify-supervisor-pin", authenticate, authController.verifySupervisorPin);

/**
 * @route   POST /api/v1/auth/set-supervisor-pin
 * @desc    Set supervisor PIN for current user
 * @access  Private
 */
router.post("/set-supervisor-pin", authenticate, authController.setSupervisorPin);

export default router;
