import { NextFunction, Request, Response } from "express";
import { BadRequestError } from "../../shared/errors/AppError";
import { sendSuccess } from "../../shared/utils/response";
import * as authService from "./auth.service";

/**
 * POST /auth/login
 * User login
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, username, password } = req.body;

    // Accept either email or username
    const identifier = email || username;

    if (!identifier || !password) {
      throw new BadRequestError("Email/username and password are required");
    }

    const result = await authService.login(identifier, password);

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Don't send refresh token in response body (it's in the cookie)
    sendSuccess(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      },
      "Login successful"
    );
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/refresh
 * Refresh access token
 */
export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    // Get refresh token from cookie or body
    const token = req.cookies?.refreshToken || req.body.refreshToken;

    if (!token) {
      throw new BadRequestError("Refresh token is required");
    }

    const result = await authService.refreshToken(token);
    sendSuccess(res, result, "Token refreshed");
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/logout
 * Logout user
 */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const token = req.cookies?.refreshToken || req.body.refreshToken;

    if (userId) {
      await authService.logout(userId, token);
    }

    // Clear cookie
    res.clearCookie("refreshToken");

    sendSuccess(res, null, "Logout successful");
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/change-password
 * Change user password
 */
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new BadRequestError("User not authenticated");
    }

    if (!currentPassword || !newPassword) {
      throw new BadRequestError("Current password and new password are required");
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestError("New passwords do not match");
    }

    if (newPassword === currentPassword) {
      throw new BadRequestError("New password must be different from current password");
    }

    await authService.changePassword(userId, currentPassword, newPassword);

    // Clear refresh token cookie (force re-login)
    res.clearCookie("refreshToken");

    sendSuccess(res, null, "Password changed successfully. Please login again.");
  } catch (error) {
    next(error);
  }
}

/**
 * GET /auth/me
 * Get current user profile
 */
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new BadRequestError("User not authenticated");
    }

    const profile = await authService.getProfile(userId);
    sendSuccess(res, profile);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/verify-supervisor-pin
 * Verify supervisor PIN for void/refund authorization
 */
export async function verifySupervisorPin(req: Request, res: Response, next: NextFunction) {
  try {
    const { supervisorId, pin, action } = req.body;

    if (!supervisorId || !pin || !action) {
      throw new BadRequestError("Supervisor ID, PIN, and action are required");
    }

    if (!["void", "refund"].includes(action)) {
      throw new BadRequestError("Action must be 'void' or 'refund'");
    }

    const result = await authService.verifySupervisorPin(
      supervisorId,
      pin,
      action as "void" | "refund"
    );

    sendSuccess(res, result, "PIN verified successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/set-supervisor-pin
 * Set supervisor PIN for current user
 */
export async function setSupervisorPin(req: Request, res: Response, next: NextFunction) {
  try {
    const { password, pin } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new BadRequestError("User not authenticated");
    }

    if (!password || !pin) {
      throw new BadRequestError("Password and PIN are required");
    }

    await authService.setSupervisorPin(userId, password, pin);
    sendSuccess(res, null, "Supervisor PIN set successfully");
  } catch (error) {
    next(error);
  }
}
