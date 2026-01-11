/**
 * Category Routes
 */

import { Router } from "express";
import * as categoryController from "./category.controller";
import { authenticate, requirePermission } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("products.view"), categoryController.getAll);
router.get("/:id", requirePermission("products.view"), categoryController.getById);
router.post("/", requirePermission("products.manage_categories"), categoryController.create);
router.put("/:id", requirePermission("products.manage_categories"), categoryController.update);
router.delete("/:id", requirePermission("products.manage_categories"), categoryController.remove);

export default router;
