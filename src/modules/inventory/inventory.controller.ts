/**
 * Inventory Controller
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendPaginated } from "../../shared/utils/response";
import { BadRequestError } from "../../shared/errors/AppError";
import * as inventoryService from "./inventory.service";

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await inventoryService.getSummary();
    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
}

export async function getMovements(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = "1", limit = "20", productId, movementType, startDate, endDate, sortOrder } = req.query;

    const result = await inventoryService.getMovements({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      productId: productId as string,
      movementType: movementType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      sortOrder: sortOrder as "asc" | "desc",
    });

    sendPaginated(res, result.movements, result.page, result.limit, result.total);
  } catch (error) {
    next(error);
  }
}

export async function getLowStock(req: Request, res: Response, next: NextFunction) {
  try {
    const products = await inventoryService.getLowStockProducts();
    sendSuccess(res, products);
  } catch (error) {
    next(error);
  }
}

export async function bulkAdjust(req: Request, res: Response, next: NextFunction) {
  try {
    const { adjustments, movementType } = req.body;

    if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
      throw new BadRequestError("Adjustments array is required");
    }

    if (!movementType) {
      throw new BadRequestError("Movement type is required");
    }

    const validTypes = ["purchase", "adjustment", "count", "damage"];
    if (!validTypes.includes(movementType)) {
      throw new BadRequestError(`Invalid movement type. Use: ${validTypes.join(", ")}`);
    }

    const result = await inventoryService.bulkAdjustStock(adjustments, movementType, req.user?.userId);
    sendSuccess(res, result, `Processed ${result.success} items successfully`);
  } catch (error) {
    next(error);
  }
}

export async function stockCount(req: Request, res: Response, next: NextFunction) {
  try {
    const { counts } = req.body;

    if (!counts || !Array.isArray(counts) || counts.length === 0) {
      throw new BadRequestError("Counts array is required");
    }

    const result = await inventoryService.stockCount(counts, req.user?.userId);
    sendSuccess(res, result, `Counted ${result.success} items. Found ${result.discrepancies.length} discrepancies.`);
  } catch (error) {
    next(error);
  }
}
