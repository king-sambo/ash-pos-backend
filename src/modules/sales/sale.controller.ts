/**
 * Sales Controller
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated, sendPaginated } from "../../shared/utils/response";
import { BadRequestError } from "../../shared/errors/AppError";
import * as saleService from "./sale.service";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { items, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestError("Items are required");
    }

    if (!paymentMethod) {
      throw new BadRequestError("Payment method is required");
    }

    const sale = await saleService.create(req.body, req.user!.userId);
    sendCreated(res, sale, "Sale completed successfully");
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const sale = await saleService.getById(id);
    sendSuccess(res, sale);
  } catch (error) {
    next(error);
  }
}

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = "1", limit = "20", startDate, endDate, status, paymentMethod, customerId, userId } = req.query;

    const result = await saleService.getAll({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      paymentMethod: paymentMethod as string,
      customerId: customerId as string,
      userId: userId as string,
    });

    sendPaginated(res, result.sales, result.page, result.limit, result.total);
  } catch (error) {
    next(error);
  }
}

export async function getTodaySales(req: Request, res: Response, next: NextFunction) {
  try {
    const { myOnly } = req.query;
    const userId = myOnly === "true" ? req.user?.userId : undefined;
    const summary = await saleService.getTodaySummary(userId);
    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
}

export async function voidSale(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { reason, supervisorId, supervisorPin } = req.body;

    if (!reason) throw new BadRequestError("Void reason is required");
    
    // Check if user can self-authorize (super_admin or manager with can_authorize_void)
    const userCanAuthorize = req.user!.canAuthorizeVoid || 
      req.user!.role?.toLowerCase() === "super_admin" || 
      req.user!.role?.toLowerCase() === "manager";

    if (userCanAuthorize) {
      // User can self-authorize - use their own ID
      const sale = await saleService.voidSaleSelfAuthorized(id, reason, req.user!.userId);
      sendSuccess(res, sale, "Sale voided successfully");
    } else {
      // Need supervisor authorization
      if (!supervisorId) throw new BadRequestError("Supervisor ID is required");
      if (!supervisorPin) throw new BadRequestError("Supervisor PIN is required");
      
      const sale = await saleService.voidSale(id, reason, supervisorId, supervisorPin, req.user!.userId);
      sendSuccess(res, sale, "Sale voided successfully");
    }
  } catch (error) {
    next(error);
  }
}

export async function refundSale(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { reason, supervisorId, supervisorPin } = req.body;

    if (!reason) throw new BadRequestError("Refund reason is required");
    
    // Check if user can self-authorize (super_admin or manager with can_authorize_refund)
    const userCanAuthorize = req.user!.canAuthorizeRefund || 
      req.user!.role?.toLowerCase() === "super_admin" || 
      req.user!.role?.toLowerCase() === "manager";

    if (userCanAuthorize) {
      // User can self-authorize - use their own ID
      const sale = await saleService.refundSaleSelfAuthorized(id, reason, req.user!.userId);
      sendSuccess(res, sale, "Sale refunded successfully");
    } else {
      // Need supervisor authorization
      if (!supervisorId) throw new BadRequestError("Supervisor ID is required");
      if (!supervisorPin) throw new BadRequestError("Supervisor PIN is required");
      
      const sale = await saleService.refundSale(id, reason, supervisorId, supervisorPin, req.user!.userId);
      sendSuccess(res, sale, "Sale refunded successfully");
    }
  } catch (error) {
    next(error);
  }
}

export async function getReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const sale = await saleService.getById(id);
    
    // Return receipt data (could be formatted for thermal printer)
    sendSuccess(res, {
      ...sale,
      receiptType: "sale",
      printedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
