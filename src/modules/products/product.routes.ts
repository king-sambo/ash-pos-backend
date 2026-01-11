/**
 * Product Routes
 */

import { Router } from "express";
import * as productController from "./product.controller";
import { authenticate, requirePermission } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("products.view"), productController.getAll);
router.get("/low-stock", requirePermission("products.view"), productController.getLowStock);
router.get("/search", requirePermission("products.view"), productController.searchByCode);
router.get("/:id", requirePermission("products.view"), productController.getById);
router.post("/", requirePermission("products.create"), productController.create);
router.put("/:id", requirePermission("products.edit"), productController.update);
router.delete("/:id", requirePermission("products.delete"), productController.remove);

// Stock management
router.post("/:id/stock", requirePermission("products.adjust_stock"), productController.adjustStock);

export default router;

