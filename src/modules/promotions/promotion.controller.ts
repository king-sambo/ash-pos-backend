/**
 * Promotions Controller
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from "../../shared/utils/response";
import * as promotionService from "./promotion.service";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = "1", limit = "20", promotionType, isActive, search } = req.query;

    const result = await promotionService.getAll({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      promotionType: promotionType as string,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      search: search as string,
    });

    sendPaginated(res, result.promotions, result.page, result.limit, result.total);
  } catch (error) {
    next(error);
  }
}

export async function getActive(req: Request, res: Response, next: NextFunction) {
  try {
    const promotions = await promotionService.getActive();
    sendSuccess(res, promotions);
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const promotion = await promotionService.getById(id);
    sendSuccess(res, promotion);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const promotion = await promotionService.create(req.body, req.user!.userId);
    sendCreated(res, promotion, "Promotion created successfully");
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const promotion = await promotionService.update(id, req.body);
    sendSuccess(res, promotion, "Promotion updated successfully");
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await promotionService.remove(id);
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
}

export async function checkApplicable(req: Request, res: Response, next: NextFunction) {
  try {
    const { items, customerId, membershipTierId, couponCode } = req.body;
    const result = await promotionService.checkApplicable({
      items,
      customerId,
      membershipTierId,
      couponCode,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
