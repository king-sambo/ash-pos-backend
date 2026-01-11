/**
 * Discounts Controller
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated, sendNoContent } from "../../shared/utils/response";
import * as discountService from "./discount.service";

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await discountService.getDiscountSettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

export async function updateSetting(req: Request, res: Response, next: NextFunction) {
  try {
    const { type } = req.params;
    const setting = await discountService.updateDiscountSetting(type, req.body);
    sendSuccess(res, setting, "Discount setting updated");
  } catch (error) {
    next(error);
  }
}

export async function getReasons(req: Request, res: Response, next: NextFunction) {
  try {
    const reasons = await discountService.getDiscountReasons();
    sendSuccess(res, reasons);
  } catch (error) {
    next(error);
  }
}

export async function createReason(req: Request, res: Response, next: NextFunction) {
  try {
    const reason = await discountService.createDiscountReason(req.body);
    sendCreated(res, reason, "Discount reason created");
  } catch (error) {
    next(error);
  }
}

export async function updateReason(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const reason = await discountService.updateDiscountReason(id, req.body);
    sendSuccess(res, reason, "Discount reason updated");
  } catch (error) {
    next(error);
  }
}

export async function deleteReason(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await discountService.deleteDiscountReason(id);
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
}

export async function getMembershipTiers(req: Request, res: Response, next: NextFunction) {
  try {
    const tiers = await discountService.getMembershipTiers();
    sendSuccess(res, tiers);
  } catch (error) {
    next(error);
  }
}

export async function createMembershipTier(req: Request, res: Response, next: NextFunction) {
  try {
    const tier = await discountService.createMembershipTier(req.body);
    sendCreated(res, tier, "Membership tier created");
  } catch (error) {
    next(error);
  }
}

export async function updateMembershipTier(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const tier = await discountService.updateMembershipTier(id, req.body);
    sendSuccess(res, tier, "Membership tier updated");
  } catch (error) {
    next(error);
  }
}

export async function getCustomerGroups(req: Request, res: Response, next: NextFunction) {
  try {
    const groups = await discountService.getCustomerGroups();
    sendSuccess(res, groups);
  } catch (error) {
    next(error);
  }
}

export async function createCustomerGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await discountService.createCustomerGroup(req.body);
    sendCreated(res, group, "Customer group created");
  } catch (error) {
    next(error);
  }
}

export async function updateCustomerGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const group = await discountService.updateCustomerGroup(id, req.body);
    sendSuccess(res, group, "Customer group updated");
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomerGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await discountService.deleteCustomerGroup(id);
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
}

export async function calculate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await discountService.calculateDiscounts(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function applyGovernmentDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    // This would be called from the POS during checkout
    sendSuccess(res, { message: "Government discount applied" });
  } catch (error) {
    next(error);
  }
}

export async function applyManualDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    // This would be called from the POS with supervisor approval
    sendSuccess(res, { message: "Manual discount applied" });
  } catch (error) {
    next(error);
  }
}

export async function getLogs(req: Request, res: Response, next: NextFunction) {
  try {
    // Return discount audit logs
    sendSuccess(res, []);
  } catch (error) {
    next(error);
  }
}

export async function getLogsBySale(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, []);
  } catch (error) {
    next(error);
  }
}