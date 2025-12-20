import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token";
import { env } from "../config/env";

export interface AuthRequest extends Request {
  user?: { id: string; sessionId: string };
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ message: "Unauthorzied" });
  }

  try {
    const payload = verifyAccessToken(token, env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      sessionId: payload.sessionId,
    };
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
