/**
 * Reports Controller
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../shared/utils/response";
import * as reportService from "./report.service";

function getDateRange(req: Request) {
  const today = new Date().toISOString().split("T")[0];
  return {
    startDate: (req.query.startDate as string) || today,
    endDate: (req.query.endDate as string) || today,
  };
}

// ============ SALES REPORTS ============

export async function salesSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const summary = await reportService.getSalesSummary(dateRange);
    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
}

export async function dailySales(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const sales = await reportService.getDailySales(dateRange);
    sendSuccess(res, sales);
  } catch (error) {
    next(error);
  }
}

export async function hourlySales(req: Request, res: Response, next: NextFunction) {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const sales = await reportService.getHourlySales(date);
    sendSuccess(res, sales);
  } catch (error) {
    next(error);
  }
}

export async function salesByCashier(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const sales = await reportService.getSalesByCashier(dateRange);
    sendSuccess(res, sales);
  } catch (error) {
    next(error);
  }
}

export async function salesByPaymentMethod(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const sales = await reportService.getSalesByPaymentMethod(dateRange);
    sendSuccess(res, sales);
  } catch (error) {
    next(error);
  }
}

export async function salesByCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const sales = await reportService.getSalesByCategory(dateRange);
    sendSuccess(res, sales);
  } catch (error) {
    next(error);
  }
}

// ============ PRODUCT REPORTS ============

export async function topSellingProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const limit = parseInt(req.query.limit as string) || 20;
    const products = await reportService.getTopSellingProducts(dateRange, limit);
    sendSuccess(res, products);
  } catch (error) {
    next(error);
  }
}

export async function lowStockReport(req: Request, res: Response, next: NextFunction) {
  try {
    const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : undefined;
    const products = await reportService.getLowStockReport(threshold);
    sendSuccess(res, products);
  } catch (error) {
    next(error);
  }
}

export async function inventoryValue(req: Request, res: Response, next: NextFunction) {
  try {
    const value = await reportService.getInventoryValue();
    sendSuccess(res, value);
  } catch (error) {
    next(error);
  }
}

export async function stockMovements(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const movements = await reportService.getStockMovementReport(dateRange);
    sendSuccess(res, movements);
  } catch (error) {
    next(error);
  }
}

// ============ CUSTOMER REPORTS ============

export async function topCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const limit = parseInt(req.query.limit as string) || 20;
    const customers = await reportService.getTopCustomers(dateRange, limit);
    sendSuccess(res, customers);
  } catch (error) {
    next(error);
  }
}

export async function membershipDistribution(req: Request, res: Response, next: NextFunction) {
  try {
    const distribution = await reportService.getMembershipDistribution();
    sendSuccess(res, distribution);
  } catch (error) {
    next(error);
  }
}

export async function newCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const customers = await reportService.getNewCustomers(dateRange);
    sendSuccess(res, customers);
  } catch (error) {
    next(error);
  }
}

// ============ DISCOUNT REPORTS ============

export async function discountSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const summary = await reportService.getDiscountSummary(dateRange);
    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
}

export async function scPwdReport(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const report = await reportService.getScPwdReport(dateRange);
    sendSuccess(res, report);
  } catch (error) {
    next(error);
  }
}

export async function manualDiscountAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const audit = await reportService.getManualDiscountAudit(dateRange);
    sendSuccess(res, audit);
  } catch (error) {
    next(error);
  }
}

export async function voidedTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const dateRange = getDateRange(req);
    const transactions = await reportService.getVoidedTransactions(dateRange);
    sendSuccess(res, transactions);
  } catch (error) {
    next(error);
  }
}

// ============ DASHBOARD ============

export async function dashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const dateRange = { startDate: today, endDate: today };

    const [salesSummary, topProducts, inventoryStats, membershipDist] = await Promise.all([
      reportService.getSalesSummary(dateRange),
      reportService.getTopSellingProducts(dateRange, 5),
      reportService.getInventoryValue(),
      reportService.getMembershipDistribution(),
    ]);

    sendSuccess(res, {
      todaySales: salesSummary.totalSales,
      todayTransactions: salesSummary.totalTransactions,
      averageTicket: salesSummary.averageTicket,
      totalDiscounts: salesSummary.totalDiscounts,
      topProducts,
      lowStockCount: inventoryStats.lowStockCount,
      outOfStockCount: inventoryStats.outOfStockCount,
      inventoryValue: inventoryStats.totalRetailValue,
      totalCustomers: membershipDist.reduce((sum, m) => sum + m.customerCount, 0),
    });
  } catch (error) {
    next(error);
  }
}
