/**
 * Settings Controller
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../shared/utils/response";
import * as settingService from "./setting.service";
import { AuthRequest } from "../../shared/middleware/auth";

// Get all settings grouped by category
export async function getAllSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingService.getAllSettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

// Get settings by category
export async function getByCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { category } = req.params;
    const settings = await settingService.getSettingsByCategory(category);
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

// Get single setting by key
export async function getByKey(req: Request, res: Response, next: NextFunction) {
  try {
    const { key } = req.params;
    const setting = await settingService.getSettingByKey(key);
    sendSuccess(res, setting);
  } catch (error) {
    next(error);
  }
}

// Get public settings (no auth required)
export async function getPublicSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingService.getPublicSettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

// Update single setting
export async function updateSetting(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.user!.id;

    const setting = await settingService.updateSetting(key, { value }, userId);
    sendSuccess(res, setting, "Setting updated successfully");
  } catch (error) {
    next(error);
  }
}

// Update multiple settings
export async function updateMultiple(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const updates = req.body;
    const userId = req.user!.id;

    const settings = await settingService.updateMultipleSettings(updates, userId);
    sendSuccess(res, settings, "Settings updated successfully");
  } catch (error) {
    next(error);
  }
}

// ============ STORE SETTINGS ============

export async function getStoreSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingService.getStoreSettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

export async function updateStoreSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const settings = await settingService.updateStoreSettings(req.body, userId);
    sendSuccess(res, settings, "Store settings updated successfully");
  } catch (error) {
    next(error);
  }
}

// ============ TAX SETTINGS ============

export async function getTaxSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingService.getTaxSettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

export async function updateTaxSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const settings = await settingService.updateTaxSettings(req.body, userId);
    sendSuccess(res, settings, "Tax settings updated successfully");
  } catch (error) {
    next(error);
  }
}

// ============ LOYALTY SETTINGS ============

export async function getLoyaltySettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingService.getLoyaltySettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

export async function updateLoyaltySettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const settings = await settingService.updateLoyaltySettings(req.body, userId);
    sendSuccess(res, settings, "Loyalty settings updated successfully");
  } catch (error) {
    next(error);
  }
}

// ============ RECEIPT SETTINGS ============

export async function getReceiptSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingService.getReceiptSettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

export async function updateReceiptSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const settings = await settingService.updateReceiptSettings(req.body, userId);
    sendSuccess(res, settings, "Receipt settings updated successfully");
  } catch (error) {
    next(error);
  }
}

// ============ SECURITY SETTINGS ============

export async function getSecuritySettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingService.getSecuritySettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

export async function updateSecuritySettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const settings = await settingService.updateSecuritySettings(req.body, userId);
    sendSuccess(res, settings, "Security settings updated successfully");
  } catch (error) {
    next(error);
  }
}

// ============ AUTHORIZATION SETTINGS ============

export async function getAuthorizationSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingService.getAuthorizationSettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

export async function updateAuthorizationSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const settings = await settingService.updateAuthorizationSettings(req.body, userId);
    sendSuccess(res, settings, "Authorization settings updated successfully");
  } catch (error) {
    next(error);
  }
}

// ============ DISCOUNT LIMITS SETTINGS ============

export async function getDiscountLimitsSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await settingService.getDiscountLimitsSettings();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

export async function updateDiscountLimitsSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const settings = await settingService.updateDiscountLimitsSettings(req.body, userId);
    sendSuccess(res, settings, "Discount limits updated successfully");
  } catch (error) {
    next(error);
  }
}
