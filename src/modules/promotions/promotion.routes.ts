/**
 * Promotions Routes
 */

import { Router } from "express";
import * as promotionController from "./promotion.controller";
import { authenticate, requirePermission } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("promotions.view"), promotionController.getAll);
router.get("/active", requirePermission("promotions.view"), promotionController.getActive);
router.get("/:id", requirePermission("promotions.view"), promotionController.getById);
router.post("/", requirePermission("promotions.create"), promotionController.create);
router.put("/:id", requirePermission("promotions.edit"), promotionController.update);
router.delete("/:id", requirePermission("promotions.delete"), promotionController.remove);
router.post("/check", requirePermission("sales.create"), promotionController.checkApplicable);

export default router;

