/**
 * Settings Service
 * Manages application configuration settings
 */

import { pool } from "../../config/database";
import { AppError } from "../../shared/errors";

interface Setting {
  id: string;
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
  category: string;
  description: string;
  isPublic: boolean;
  updatedAt: string;
}

interface SettingUpdate {
  value: string | number | boolean | object;
}

// Parse value based on type
function parseValue(value: string, type: string): string | number | boolean | object {
  switch (type) {
    case "number":
      return parseFloat(value);
    case "boolean":
      return value === "true";
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

// Serialize value for storage
function serializeValue(value: string | number | boolean | object): string {
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

// ============ GET SETTINGS ============

export async function getAllSettings(): Promise<Record<string, Setting[]>> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        id,
        key,
        value,
        type,
        category,
        description,
        is_public AS "isPublic",
        updated_at AS "updatedAt"
      FROM settings
      ORDER BY category, key
    `);

    // Group by category
    const grouped: Record<string, Setting[]> = {};
    result.rows.forEach((row) => {
      if (!grouped[row.category]) {
        grouped[row.category] = [];
      }
      grouped[row.category].push({
        ...row,
        value: parseValue(row.value, row.type),
      });
    });

    return grouped;
  } finally {
    client.release();
  }
}

export async function getSettingsByCategory(category: string): Promise<Setting[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT 
        id,
        key,
        value,
        type,
        category,
        description,
        is_public AS "isPublic",
        updated_at AS "updatedAt"
      FROM settings
      WHERE category = $1
      ORDER BY key
    `,
      [category]
    );

    return result.rows.map((row) => ({
      ...row,
      value: parseValue(row.value, row.type),
    }));
  } finally {
    client.release();
  }
}

export async function getSettingByKey(key: string): Promise<Setting | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT 
        id,
        key,
        value,
        type,
        category,
        description,
        is_public AS "isPublic",
        updated_at AS "updatedAt"
      FROM settings
      WHERE key = $1
    `,
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      value: parseValue(row.value, row.type),
    };
  } finally {
    client.release();
  }
}

export async function getSettingValue<T = string | number | boolean>(key: string): Promise<T | null> {
  const setting = await getSettingByKey(key);
  if (!setting) return null;
  return setting.value as T;
}

export async function getPublicSettings(): Promise<Record<string, any>> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT key, value, type
      FROM settings
      WHERE is_public = TRUE
    `);

    const settings: Record<string, any> = {};
    result.rows.forEach((row) => {
      settings[row.key] = parseValue(row.value, row.type);
    });

    return settings;
  } finally {
    client.release();
  }
}

// ============ UPDATE SETTINGS ============

export async function updateSetting(
  key: string,
  update: SettingUpdate,
  userId: string
): Promise<Setting> {
  const client = await pool.connect();
  try {
    // Check if setting exists
    const existing = await client.query("SELECT * FROM settings WHERE key = $1", [key]);
    if (existing.rows.length === 0) {
      throw new AppError(`Setting '${key}' not found`, 404);
    }

    const serializedValue = serializeValue(update.value);

    const result = await client.query(
      `
      UPDATE settings
      SET value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE key = $3
      RETURNING 
        id,
        key,
        value,
        type,
        category,
        description,
        is_public AS "isPublic",
        updated_at AS "updatedAt"
    `,
      [serializedValue, userId, key]
    );

    const row = result.rows[0];
    return {
      ...row,
      value: parseValue(row.value, row.type),
    };
  } finally {
    client.release();
  }
}

export async function updateMultipleSettings(
  updates: Record<string, any>,
  userId: string
): Promise<Setting[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updatedSettings: Setting[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const serializedValue = serializeValue(value);

      const result = await client.query(
        `
        UPDATE settings
        SET value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE key = $3
        RETURNING 
          id,
          key,
          value,
          type,
          category,
          description,
          is_public AS "isPublic",
          updated_at AS "updatedAt"
      `,
        [serializedValue, userId, key]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        updatedSettings.push({
          ...row,
          value: parseValue(row.value, row.type),
        });
      }
    }

    await client.query("COMMIT");
    return updatedSettings;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ============ STORE SETTINGS ============

export async function getStoreSettings(): Promise<Record<string, any>> {
  const settings = await getSettingsByCategory("store");
  const result: Record<string, any> = {};
  settings.forEach((s) => {
    // Convert snake_case keys to camelCase for frontend
    const key = s.key.replace("store_", "").replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    result[key] = s.value;
  });
  return result;
}

export async function updateStoreSettings(
  data: {
    name?: string;
    addressLine1?: string;
    addressLine2?: string;
    phone?: string;
    email?: string;
    tin?: string;
    logoUrl?: string;
  },
  userId: string
): Promise<Record<string, any>> {
  const updates: Record<string, any> = {};

  if (data.name !== undefined) updates.store_name = data.name;
  if (data.addressLine1 !== undefined) updates.store_address_line1 = data.addressLine1;
  if (data.addressLine2 !== undefined) updates.store_address_line2 = data.addressLine2;
  if (data.phone !== undefined) updates.store_phone = data.phone;
  if (data.email !== undefined) updates.store_email = data.email;
  if (data.tin !== undefined) updates.store_tin = data.tin;
  if (data.logoUrl !== undefined) updates.store_logo_url = data.logoUrl;

  await updateMultipleSettings(updates, userId);
  return getStoreSettings();
}

// ============ TAX SETTINGS ============

export async function getTaxSettings(): Promise<{ taxRate: number; taxInclusive: boolean }> {
  const settings = await getSettingsByCategory("tax");
  const result: any = {};
  settings.forEach((s) => {
    // Map setting keys to camelCase
    if (s.key === "tax_rate") result.taxRate = s.value;
    if (s.key === "tax_inclusive") result.taxInclusive = s.value;
  });
  return {
    taxRate: result.taxRate ?? 12,
    taxInclusive: result.taxInclusive ?? true,
  };
}

export async function updateTaxSettings(
  data: { taxRate?: number; taxInclusive?: boolean },
  userId: string
): Promise<{ taxRate: number; taxInclusive: boolean }> {
  const updates: Record<string, any> = {};

  if (data.taxRate !== undefined) updates.tax_rate = data.taxRate;
  if (data.taxInclusive !== undefined) updates.tax_inclusive = data.taxInclusive;

  await updateMultipleSettings(updates, userId);
  return getTaxSettings();
}

// ============ LOYALTY SETTINGS ============

export interface LoyaltySettingsData {
  enable: boolean;
  pesoThreshold: number;
  pointsPerThreshold: number;
  redemptionValue: number;
  minRedemption: number;
  maxRedemptionPercent: number;
  expiryDays: number;
  earnOnDiscounted: boolean;
  earnOnScPwd: boolean;
}

export async function getLoyaltySettings(): Promise<LoyaltySettingsData> {
  const settings = await getSettingsByCategory("loyalty");
  const result: Record<string, any> = {};
  
  // Map database keys to camelCase keys
  const keyMap: Record<string, string> = {
    loyalty_enable: "enable",
    loyalty_peso_threshold: "pesoThreshold",
    loyalty_points_per_threshold: "pointsPerThreshold",
    loyalty_redemption_value: "redemptionValue",
    loyalty_min_redemption: "minRedemption",
    loyalty_max_redemption_percent: "maxRedemptionPercent",
    loyalty_expiry_days: "expiryDays",
    loyalty_earn_on_discounted: "earnOnDiscounted",
    loyalty_earn_on_sc_pwd: "earnOnScPwd",
  };

  settings.forEach((s) => {
    const camelKey = keyMap[s.key];
    if (camelKey) {
      result[camelKey] = s.value;
    }
  });

  return {
    enable: result.enable ?? true,
    pesoThreshold: result.pesoThreshold ?? 100,
    pointsPerThreshold: result.pointsPerThreshold ?? 1,
    redemptionValue: result.redemptionValue ?? 1,
    minRedemption: result.minRedemption ?? 100,
    maxRedemptionPercent: result.maxRedemptionPercent ?? 50,
    expiryDays: result.expiryDays ?? 365,
    earnOnDiscounted: result.earnOnDiscounted ?? true,
    earnOnScPwd: result.earnOnScPwd ?? false,
  };
}

export async function updateLoyaltySettings(
  data: Partial<LoyaltySettingsData>,
  userId: string
): Promise<LoyaltySettingsData> {
  const updates: Record<string, any> = {};

  // Map camelCase to database keys
  const keyMap: Record<string, string> = {
    enable: "loyalty_enable",
    pesoThreshold: "loyalty_peso_threshold",
    pointsPerThreshold: "loyalty_points_per_threshold",
    redemptionValue: "loyalty_redemption_value",
    minRedemption: "loyalty_min_redemption",
    maxRedemptionPercent: "loyalty_max_redemption_percent",
    expiryDays: "loyalty_expiry_days",
    earnOnDiscounted: "loyalty_earn_on_discounted",
    earnOnScPwd: "loyalty_earn_on_sc_pwd",
  };

  for (const [camelKey, dbKey] of Object.entries(keyMap)) {
    if (data[camelKey as keyof LoyaltySettingsData] !== undefined) {
      updates[dbKey] = data[camelKey as keyof LoyaltySettingsData];
    }
  }

  await updateMultipleSettings(updates, userId);
  return getLoyaltySettings();
}

// ============ RECEIPT SETTINGS ============

export interface ReceiptSettingsData {
  header: string;
  footer: string;
  showCashier: boolean;
}

export async function getReceiptSettings(): Promise<ReceiptSettingsData> {
  const settings = await getSettingsByCategory("receipt");
  const result: Record<string, any> = {};

  const keyMap: Record<string, string> = {
    receipt_header: "header",
    receipt_footer: "footer",
    receipt_show_cashier: "showCashier",
  };

  settings.forEach((s) => {
    const camelKey = keyMap[s.key];
    if (camelKey) {
      result[camelKey] = s.value;
    }
  });

  return {
    header: result.header ?? "",
    footer: result.footer ?? "Thank you for shopping with us!",
    showCashier: result.showCashier ?? true,
  };
}

export async function updateReceiptSettings(
  data: Partial<ReceiptSettingsData>,
  userId: string
): Promise<ReceiptSettingsData> {
  const updates: Record<string, any> = {};

  if (data.header !== undefined) updates.receipt_header = data.header;
  if (data.footer !== undefined) updates.receipt_footer = data.footer;
  if (data.showCashier !== undefined) updates.receipt_show_cashier = data.showCashier;

  await updateMultipleSettings(updates, userId);
  return getReceiptSettings();
}

// ============ SECURITY SETTINGS ============

export interface SecuritySettingsData {
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  passwordMinLength: number;
}

export async function getSecuritySettings(): Promise<SecuritySettingsData> {
  const settings = await getSettingsByCategory("security");
  const result: Record<string, any> = {};

  const keyMap: Record<string, string> = {
    session_timeout_minutes: "sessionTimeoutMinutes",
    max_login_attempts: "maxLoginAttempts",
    lockout_duration_minutes: "lockoutDurationMinutes",
    password_min_length: "passwordMinLength",
  };

  settings.forEach((s) => {
    const camelKey = keyMap[s.key];
    if (camelKey) {
      result[camelKey] = s.value;
    }
  });

  return {
    sessionTimeoutMinutes: result.sessionTimeoutMinutes ?? 30,
    maxLoginAttempts: result.maxLoginAttempts ?? 5,
    lockoutDurationMinutes: result.lockoutDurationMinutes ?? 15,
    passwordMinLength: result.passwordMinLength ?? 8,
  };
}

export async function updateSecuritySettings(
  data: Partial<SecuritySettingsData>,
  userId: string
): Promise<SecuritySettingsData> {
  const updates: Record<string, any> = {};

  if (data.sessionTimeoutMinutes !== undefined) updates.session_timeout_minutes = data.sessionTimeoutMinutes;
  if (data.maxLoginAttempts !== undefined) updates.max_login_attempts = data.maxLoginAttempts;
  if (data.lockoutDurationMinutes !== undefined) updates.lockout_duration_minutes = data.lockoutDurationMinutes;
  if (data.passwordMinLength !== undefined) updates.password_min_length = data.passwordMinLength;

  await updateMultipleSettings(updates, userId);
  return getSecuritySettings();
}

// ============ AUTHORIZATION SETTINGS ============

export interface AuthorizationSettingsData {
  voidRequiresSupervisor: boolean;
  refundRequiresSupervisor: boolean;
  voidTimeLimitMinutes: number;
}

export async function getAuthorizationSettings(): Promise<AuthorizationSettingsData> {
  const settings = await getSettingsByCategory("authorization");
  const result: Record<string, any> = {};

  const keyMap: Record<string, string> = {
    void_requires_supervisor: "voidRequiresSupervisor",
    refund_requires_supervisor: "refundRequiresSupervisor",
    void_time_limit_minutes: "voidTimeLimitMinutes",
  };

  settings.forEach((s) => {
    const camelKey = keyMap[s.key];
    if (camelKey) {
      result[camelKey] = s.value;
    }
  });

  return {
    voidRequiresSupervisor: result.voidRequiresSupervisor ?? true,
    refundRequiresSupervisor: result.refundRequiresSupervisor ?? true,
    voidTimeLimitMinutes: result.voidTimeLimitMinutes ?? 30,
  };
}

export async function updateAuthorizationSettings(
  data: Partial<AuthorizationSettingsData>,
  userId: string
): Promise<AuthorizationSettingsData> {
  const updates: Record<string, any> = {};

  if (data.voidRequiresSupervisor !== undefined) updates.void_requires_supervisor = data.voidRequiresSupervisor;
  if (data.refundRequiresSupervisor !== undefined) updates.refund_requires_supervisor = data.refundRequiresSupervisor;
  if (data.voidTimeLimitMinutes !== undefined) updates.void_time_limit_minutes = data.voidTimeLimitMinutes;

  await updateMultipleSettings(updates, userId);
  return getAuthorizationSettings();
}

// ============ DISCOUNT LIMITS SETTINGS ============

interface DiscountLimitsData {
  maxDiscountCashier: number;
  maxDiscountManager: number;
  requireDiscountReason: boolean;
}

const discountLimitsKeyMap: Record<string, keyof DiscountLimitsData> = {
  max_discount_cashier: "maxDiscountCashier",
  max_discount_manager: "maxDiscountManager",
  require_discount_reason: "requireDiscountReason",
};

export async function getDiscountLimitsSettings(): Promise<DiscountLimitsData> {
  const settings = await getSettingsByCategory("discount");
  const result: Partial<DiscountLimitsData> = {};

  for (const s of settings) {
    const mappedKey = discountLimitsKeyMap[s.key];
    if (mappedKey) {
      result[mappedKey] = s.value as any;
    }
  }

  return {
    maxDiscountCashier: result.maxDiscountCashier ?? 5,
    maxDiscountManager: result.maxDiscountManager ?? 20,
    requireDiscountReason: result.requireDiscountReason ?? true,
  };
}

export async function updateDiscountLimitsSettings(
  data: Partial<DiscountLimitsData>,
  userId: string
): Promise<DiscountLimitsData> {
  const updates: Record<string, any> = {};

  if (data.maxDiscountCashier !== undefined) updates.max_discount_cashier = data.maxDiscountCashier;
  if (data.maxDiscountManager !== undefined) updates.max_discount_manager = data.maxDiscountManager;
  if (data.requireDiscountReason !== undefined) updates.require_discount_reason = data.requireDiscountReason;

  await updateMultipleSettings(updates, userId);
  return getDiscountLimitsSettings();
}
