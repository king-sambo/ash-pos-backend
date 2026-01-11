/**
 * Customer Routes
 */

import { Router } from "express";
import * as customerController from "./customer.controller";
import { authenticate, requirePermission } from "../../shared/middleware/auth";

const router = Router();

router.use(authenticate);

// Get membership tiers (before :id routes)
router.get("/tiers", requirePermission("customers.view"), customerController.getMembershipTiers);

// Quick search
router.get("/search", requirePermission("customers.view"), customerController.quickSearch);

// CRUD
router.get("/", requirePermission("customers.view"), customerController.getAll);
router.get("/:id", requirePermission("customers.view"), customerController.getById);
router.post("/", requirePermission("customers.create"), customerController.create);
router.put("/:id", requirePermission("customers.edit"), customerController.update);
router.delete("/:id", requirePermission("customers.delete"), customerController.remove);

// Membership
router.put("/:id/membership", requirePermission("customers.manage_membership"), customerController.updateMembership);

// Loyalty points
router.post("/:id/loyalty-points", requirePermission("customers.edit"), customerController.addLoyaltyPoints);
router.post("/:id/loyalty-points/redeem", requirePermission("customers.edit"), customerController.redeemLoyaltyPoints);

// Customer groups
router.get("/:id/groups", requirePermission("customers.view"), customerController.getGroups);
router.post("/:id/groups", requirePermission("customers.edit"), customerController.addToGroup);
router.delete("/:id/groups/:groupId", requirePermission("customers.edit"), customerController.removeFromGroup);

export default router;
