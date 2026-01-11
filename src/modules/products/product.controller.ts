/**
 * Product Controller
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from "../../shared/utils/response";
import { BadRequestError } from "../../shared/errors/AppError";
import * as productService from "./product.service";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = "1", limit = "10", search, categoryId, status, lowStock, sortBy, sortOrder } = req.query;

    const result = await productService.getAll({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      search: search as string,
      categoryId: categoryId as string,
      status: status as string,
      lowStock: lowStock === "true",
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
    });

    sendPaginated(res, result.products, result.page, result.limit, result.total);
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const product = await productService.getById(id);
    sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
}

export async function searchByCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.query;
    if (!code) throw new BadRequestError("Code is required");
    const product = await productService.searchByCode(code as string);
    sendSuccess(res, product);
  } catch (error) {
    next(error);
  }
}

export async function getLowStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit = "20" } = req.query;
    const products = await productService.getLowStock(parseInt(limit as string));
    sendSuccess(res, products);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, sellingPrice, costPrice } = req.body;
    
    if (!name) throw new BadRequestError("Product name is required");
    if (sellingPrice === undefined) throw new BadRequestError("Selling price is required");
    if (costPrice === undefined) throw new BadRequestError("Cost price is required");

    const product = await productService.create({ ...req.body, createdBy: req.user?.userId });
    sendCreated(res, product, "Product created successfully");
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const product = await productService.update(id, req.body);
    sendSuccess(res, product, "Product updated successfully");
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await productService.remove(id);
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
}

export async function adjustStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { quantity, movementType, notes } = req.body;

    if (quantity === undefined) throw new BadRequestError("Quantity is required");
    if (!movementType) throw new BadRequestError("Movement type is required");

    const validTypes = ["purchase", "adjustment", "return", "damage", "count"];
    if (!validTypes.includes(movementType)) {
      throw new BadRequestError(`Invalid movement type. Use: ${validTypes.join(", ")}`);
    }

    const product = await productService.adjustStock(id, quantity, movementType, notes, req.user?.userId);
    sendSuccess(res, product, "Stock adjusted successfully");
  } catch (error) {
    next(error);
  }
}
