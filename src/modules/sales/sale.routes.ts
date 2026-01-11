/**
 * Sales Routes
 */

import { Router } from "express";
import * as saleController from "./sale.controller";
import { authenticate, requirePermission } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("sales.view"), saleController.getAll);
router.get("/today", requirePermission("sales.view"), saleController.getTodaySales);
router.get("/:id", requirePermission("sales.view"), saleController.getById);
router.post("/", requirePermission("sales.create"), saleController.create);
router.post("/:id/void", requirePermission("sales.void"), saleController.voidSale);
router.post("/:id/refund", requirePermission("sales.refund"), saleController.refundSale);
router.get("/:id/receipt", requirePermission("sales.view"), saleController.getReceipt);

export default router;

