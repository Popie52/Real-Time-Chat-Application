import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
// import { Types } from "mongoose";

interface AccessTokenPayload {
  sub: string;
  sessionId: string;
}

export const signAccessToken = (
  payload: AccessTokenPayload,
  secret: string,
  expiresIn: SignOptions["expiresIn"]
): string => {
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyAccessToken = (
  token: string,
  secret: string
): AccessTokenPayload => {
  return jwt.verify(token, secret) as AccessTokenPayload;
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};
