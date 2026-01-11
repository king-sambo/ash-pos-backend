/**
 * Dashboard Routes
 */

import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import { authenticate, requirePermission } from "../../shared/middleware/auth";

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/dashboard/overview
 * @desc    Get complete dashboard overview
 * @access  Private (dashboard.view)
 */
router.get(
  "/overview",
  requirePermission("dashboard.view"),
  dashboardController.getOverview
);

/**
 * @route   GET /api/v1/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (dashboard.view)
 */
router.get(
  "/stats",
  requirePermission("dashboard.view"),
  dashboardController.getStats
);

/**
 * @route   GET /api/v1/dashboard/sales-trend
 * @desc    Get sales trend data
 * @access  Private (dashboard.view)
 */
router.get(
  "/sales-trend",
  requirePermission("dashboard.view"),
  dashboardController.getSalesTrend
);

/**
 * @route   GET /api/v1/dashboard/top-products
 * @desc    Get top selling products
 * @access  Private (dashboard.view)
 */
router.get(
  "/top-products",
  requirePermission("dashboard.view"),
  dashboardController.getTopProducts
);

/**
 * @route   GET /api/v1/dashboard/low-stock
 * @desc    Get low stock products
 * @access  Private (dashboard.view)
 */
router.get(
  "/low-stock",
  requirePermission("dashboard.view"),
  dashboardController.getLowStock
);

/**
 * @route   GET /api/v1/dashboard/recent-transactions
 * @desc    Get recent transactions
 * @access  Private (dashboard.view)
 */
router.get(
  "/recent-transactions",
  requirePermission("dashboard.view"),
  dashboardController.getRecentTransactions
);

/**
 * @route   GET /api/v1/dashboard/hourly-sales
 * @desc    Get hourly sales distribution
 * @access  Private (dashboard.view)
 */
router.get(
  "/hourly-sales",
  requirePermission("dashboard.view"),
  dashboardController.getHourlySales
);

export default router;
