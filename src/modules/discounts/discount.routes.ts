/**
 * Discounts Routes
 */

import { Router } from "express";
import * as discountController from "./discount.controller";
import { authenticate, requirePermission } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

// Discount settings (government discounts)
router.get("/settings", requirePermission("discounts.view"), discountController.getSettings);
router.put("/settings/:type", requirePermission("discounts.manage"), discountController.updateSetting);

// Discount reasons
router.get("/reasons", requirePermission("discounts.view"), discountController.getReasons);
router.post("/reasons", requirePermission("discounts.manage"), discountController.createReason);
router.put("/reasons/:id", requirePermission("discounts.manage"), discountController.updateReason);
router.delete("/reasons/:id", requirePermission("discounts.manage"), discountController.deleteReason);

// Calculate discounts for a transaction
router.post("/calculate", requirePermission("sales.create"), discountController.calculate);

// Government discounts (SC/PWD)
router.post("/government", requirePermission("sales.create"), discountController.applyGovernmentDiscount);

// Manual/Management discounts
router.post("/manual", requirePermission("sales.apply_manual_discount"), discountController.applyManualDiscount);

// Discount logs
router.get("/logs", requirePermission("discounts.view"), discountController.getLogs);
router.get("/logs/:saleId", requirePermission("sales.view"), discountController.getLogsBySale);

// Customer groups
router.get("/groups", requirePermission("discounts.view"), discountController.getCustomerGroups);
router.post("/groups", requirePermission("discounts.manage"), discountController.createCustomerGroup);
router.put("/groups/:id", requirePermission("discounts.manage"), discountController.updateCustomerGroup);
router.delete("/groups/:id", requirePermission("discounts.manage"), discountController.deleteCustomerGroup);

// Membership tiers
router.get("/tiers", requirePermission("discounts.view"), discountController.getMembershipTiers);
router.post("/tiers", requirePermission("discounts.manage"), discountController.createMembershipTier);
router.put("/tiers/:id", requirePermission("discounts.manage"), discountController.updateMembershipTier);

export default router;

