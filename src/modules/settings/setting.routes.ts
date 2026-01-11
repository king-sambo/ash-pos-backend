/**
 * Settings Routes
 */

import { Router } from "express";
import * as settingController from "./setting.controller";
import { authenticate, authorize, requirePermission } from "../../shared/middleware/auth";

const router = Router();

// Public settings (no auth required)
router.get("/public", settingController.getPublicSettings);

// Protected routes
router.use(authenticate);

// Get all settings
router.get("/", requirePermission("settings.view"), settingController.getAllSettings);

// Get by category
router.get("/category/:category", requirePermission("settings.view"), settingController.getByCategory);

// Get by key
router.get("/key/:key", requirePermission("settings.view"), settingController.getByKey);

// Update single setting
router.put("/key/:key", authorize("SUPER_ADMIN"), settingController.updateSetting);

// Update multiple settings
router.put("/bulk", authorize("SUPER_ADMIN"), settingController.updateMultiple);

// ============ STORE SETTINGS ============
router.get("/store", requirePermission("settings.view"), settingController.getStoreSettings);
router.put("/store", authorize("SUPER_ADMIN"), settingController.updateStoreSettings);

// ============ TAX SETTINGS ============
router.get("/tax", requirePermission("settings.view"), settingController.getTaxSettings);
router.put("/tax", authorize("SUPER_ADMIN"), settingController.updateTaxSettings);

// ============ LOYALTY SETTINGS ============
router.get("/loyalty", requirePermission("settings.view"), settingController.getLoyaltySettings);
router.put("/loyalty", authorize("SUPER_ADMIN"), settingController.updateLoyaltySettings);

// ============ RECEIPT SETTINGS ============
router.get("/receipt", requirePermission("settings.view"), settingController.getReceiptSettings);
router.put("/receipt", authorize("SUPER_ADMIN"), settingController.updateReceiptSettings);

// ============ SECURITY SETTINGS ============
router.get("/security", authorize("SUPER_ADMIN"), settingController.getSecuritySettings);
router.put("/security", authorize("SUPER_ADMIN"), settingController.updateSecuritySettings);

// ============ AUTHORIZATION SETTINGS ============
router.get("/authorization", authorize("SUPER_ADMIN", "MANAGER"), settingController.getAuthorizationSettings);
router.put("/authorization", authorize("SUPER_ADMIN"), settingController.updateAuthorizationSettings);

// ============ DISCOUNT LIMITS SETTINGS ============
router.get("/discount-limits", requirePermission("settings.view"), settingController.getDiscountLimitsSettings);
router.put("/discount-limits", authorize("SUPER_ADMIN"), settingController.updateDiscountLimitsSettings);

export default router;
