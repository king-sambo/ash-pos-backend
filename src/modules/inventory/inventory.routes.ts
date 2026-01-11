/**
 * Inventory Routes
 */

import { Router } from "express";
import * as inventoryController from "./inventory.controller";
import { authenticate, requirePermission } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/summary", requirePermission("products.view"), inventoryController.getSummary);
router.get("/movements", requirePermission("products.view"), inventoryController.getMovements);
router.get("/low-stock", requirePermission("products.view"), inventoryController.getLowStock);
router.post("/bulk-adjust", requirePermission("products.adjust_stock"), inventoryController.bulkAdjust);
router.post("/stock-count", requirePermission("products.adjust_stock"), inventoryController.stockCount);

export default router;
