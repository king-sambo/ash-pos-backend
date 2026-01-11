/**
 * Customer Controller
 * Handles HTTP requests for customer management
 */

import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from "../../shared/utils/response";
import { BadRequestError } from "../../shared/errors/AppError";
import * as customerService from "./customer.service";

/**
 * GET /customers
 * Get all customers with pagination and filters
 */
export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      page = "1",
      limit = "10",
      search,
      membershipTierId,
      isSeniorCitizen,
      isPwd,
      isActive,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await customerService.getAll({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      search: search as string,
      membershipTierId: membershipTierId as string,
      isSeniorCitizen: isSeniorCitizen === "true" ? true : isSeniorCitizen === "false" ? false : undefined,
      isPwd: isPwd === "true" ? true : isPwd === "false" ? false : undefined,
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
    });

    sendPaginated(res, result.customers, result.page, result.limit, result.total);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /customers/search
 * Quick search by code, membership ID, phone, or barcode
 */
export async function quickSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = req.query;
    if (!q) {
      throw new BadRequestError("Search query is required");
    }

    const customer = await customerService.search(q as string);
    sendSuccess(res, customer);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /customers/tiers
 * Get all membership tiers
 */
export async function getMembershipTiers(req: Request, res: Response, next: NextFunction) {
  try {
    const tiers = await customerService.getMembershipTiers();
    sendSuccess(res, tiers);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /customers/:id
 * Get customer by ID
 */
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const customer = await customerService.getById(id);
    sendSuccess(res, customer);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /customers
 * Create a new customer
 */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      province,
      postalCode,
      birthdate,
      gender,
      membershipTierId,
      isSeniorCitizen,
      seniorCitizenId,
      isPwd,
      pwdId,
      isSoloParent,
      soloParentId,
      notes,
    } = req.body;

    if (!firstName || !lastName) {
      throw new BadRequestError("First name and last name are required");
    }

    const customer = await customerService.create({
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      province,
      postalCode,
      birthdate,
      gender,
      membershipTierId,
      isSeniorCitizen,
      seniorCitizenId,
      isPwd,
      pwdId,
      isSoloParent,
      soloParentId,
      notes,
      createdBy: req.user?.userId,
    });

    sendCreated(res, customer, "Customer created successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /customers/:id
 * Update a customer
 */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const customer = await customerService.update(id, req.body);
    sendSuccess(res, customer, "Customer updated successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /customers/:id
 * Soft delete a customer
 */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await customerService.remove(id);
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /customers/:id/membership
 * Issue membership card
 */
export async function issueMembership(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { tierId, membershipId, barcode } = req.body;

    if (!tierId) {
      throw new BadRequestError("Membership tier is required");
    }

    const customer = await customerService.issueMembership(id, tierId, membershipId, barcode);
    sendSuccess(res, customer, "Membership issued successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /customers/:id/membership
 * Update/renew membership
 */
export async function updateMembership(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { action, newCardIssued, tierId, membershipId, barcode } = req.body;

    let customer;
    if (action === "renew") {
      customer = await customerService.renewMembership(id, newCardIssued);
    } else if (action === "issue") {
      if (!tierId) {
        throw new BadRequestError("Membership tier is required");
      }
      customer = await customerService.issueMembership(id, tierId, membershipId, barcode);
    } else {
      throw new BadRequestError("Invalid action. Use 'renew' or 'issue'");
    }

    sendSuccess(res, customer, "Membership updated successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * POST /customers/:id/loyalty-points
 * Add loyalty points
 */
export async function addLoyaltyPoints(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { points, transactionType, description, referenceId } = req.body;

    if (!points || !transactionType || !description) {
      throw new BadRequestError("Points, transaction type, and description are required");
    }

    if (!["earn", "bonus", "adjust"].includes(transactionType)) {
      throw new BadRequestError("Invalid transaction type");
    }

    const customer = await customerService.addLoyaltyPoints(
      id,
      points,
      transactionType,
      description,
      referenceId,
      req.user?.userId
    );

    sendSuccess(res, customer, "Loyalty points added successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * POST /customers/:id/loyalty-points/redeem
 * Redeem loyalty points
 */
export async function redeemLoyaltyPoints(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { points, description, referenceId } = req.body;

    if (!points || !description) {
      throw new BadRequestError("Points and description are required");
    }

    const customer = await customerService.redeemLoyaltyPoints(
      id,
      points,
      description,
      referenceId,
      req.user?.userId
    );

    sendSuccess(res, customer, "Loyalty points redeemed successfully");
  } catch (error) {
    next(error);
  }
}

// Placeholder functions for groups (to be implemented)
export async function getGroups(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, []);
  } catch (error) {
    next(error);
  }
}

export async function addToGroup(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, null, "Added to group");
  } catch (error) {
    next(error);
  }
}

export async function removeFromGroup(req: Request, res: Response, next: NextFunction) {
  try {
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
}