/**
 * Reports Routes
 */

import { Router } from "express";
import * as reportController from "./report.controller";
import { authenticate, requirePermission } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

// Sales reports
router.get("/sales/summary", requirePermission("reports.view"), reportController.salesSummary);
router.get("/sales/daily", requirePermission("reports.view"), reportController.dailySales);
router.get("/sales/hourly", requirePermission("reports.view"), reportController.hourlySales);
router.get("/sales/by-cashier", requirePermission("reports.view"), reportController.salesByCashier);
router.get("/sales/by-payment", requirePermission("reports.view"), reportController.salesByPaymentMethod);
router.get("/sales/by-category", requirePermission("reports.view"), reportController.salesByCategory);

// Product reports
router.get("/products/top-selling", requirePermission("reports.view"), reportController.topSellingProducts);
router.get("/products/low-stock", requirePermission("reports.view"), reportController.lowStockReport);
router.get("/products/inventory-value", requirePermission("reports.view"), reportController.inventoryValue);
router.get("/products/stock-movements", requirePermission("reports.view"), reportController.stockMovements);

// Customer reports
router.get("/customers/top", requirePermission("reports.view"), reportController.topCustomers);
router.get("/customers/membership", requirePermission("reports.view"), reportController.membershipDistribution);
router.get("/customers/new", requirePermission("reports.view"), reportController.newCustomers);

// Discount reports
router.get("/discounts/summary", requirePermission("reports.view"), reportController.discountSummary);
router.get("/discounts/sc-pwd", requirePermission("reports.view"), reportController.scPwdReport);
router.get("/discounts/manual-audit", requirePermission("reports.view"), reportController.manualDiscountAudit);
router.get("/discounts/voided", requirePermission("reports.view"), reportController.voidedTransactions);

// Dashboard stats
router.get("/dashboard", requirePermission("reports.view"), reportController.dashboardStats);

export default router;

