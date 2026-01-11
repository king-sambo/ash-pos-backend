/**
 * Dashboard Controller
 * Handles HTTP requests for dashboard endpoints
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../shared/utils/response";
import * as dashboardService from "./dashboard.service";

/**
 * GET /dashboard/stats
 * Get dashboard summary statistics
 */
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await dashboardService.getDashboardStats();
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /dashboard/sales-trend
 * Get sales trend data
 */
export async function getSalesTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as "daily" | "weekly" | "monthly") || "daily";
    const days = parseInt(req.query.days as string) || 7;
    
    const trend = await dashboardService.getSalesTrend(period, days);
    sendSuccess(res, trend);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /dashboard/top-products
 * Get top selling products
 */
export async function getTopProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const products = await dashboardService.getTopProducts(limit);
    sendSuccess(res, products);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /dashboard/low-stock
 * Get products with low stock
 */
export async function getLowStock(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const products = await dashboardService.getLowStockProducts(limit);
    sendSuccess(res, products);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /dashboard/recent-transactions
 * Get recent transactions
 */
export async function getRecentTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const transactions = await dashboardService.getRecentTransactions(limit);
    sendSuccess(res, transactions);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /dashboard/hourly-sales
 * Get hourly sales distribution for today
 */
export async function getHourlySales(req: Request, res: Response, next: NextFunction) {
  try {
    const hourlySales = await dashboardService.getHourlySales();
    sendSuccess(res, hourlySales);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /dashboard/overview
 * Get complete dashboard overview (all data in one request)
 */
export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const [stats, salesTrend, topProducts, lowStock, recentTransactions, hourlySales] = 
      await Promise.all([
        dashboardService.getDashboardStats(),
        dashboardService.getSalesTrend("daily", 7),
        dashboardService.getTopProducts(5),
        dashboardService.getLowStockProducts(5),
        dashboardService.getRecentTransactions(5),
        dashboardService.getHourlySales(),
      ]);

    sendSuccess(res, {
      stats,
      salesTrend,
      topProducts,
      lowStock,
      recentTransactions,
      hourlySales,
    });
  } catch (error) {
    next(error);
  }
}
