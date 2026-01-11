/**
 * Category Controller
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated, sendNoContent } from "../../shared/utils/response";
import { BadRequestError } from "../../shared/errors/AppError";
import * as categoryService from "./category.service";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const { includeInactive } = req.query;
    const categories = await categoryService.getAll(includeInactive === "true");
    sendSuccess(res, categories);
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const category = await categoryService.getById(id);
    sendSuccess(res, category);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body;
    if (!name) throw new BadRequestError("Category name is required");

    const category = await categoryService.create(req.body);
    sendCreated(res, category, "Category created successfully");
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const category = await categoryService.update(id, req.body);
    sendSuccess(res, category, "Category updated successfully");
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await categoryService.remove(id);
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
}
