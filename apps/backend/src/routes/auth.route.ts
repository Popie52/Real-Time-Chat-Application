import { Router } from "express";
import { UserModel } from "../models/user.model";
import { SessionModel } from "../models/session.model";
import { generateRefreshToken, signAccessToken } from "../utils/token";
import { env } from "../config/env";
import { hashValue, verifyHash } from "../utils/hash";

export const authRouter = Router();


// login
authRouter.post("/", async (req, res, next) => {
  try {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };
    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid Credentials" });
    }

    const passwordValid = await verifyHash(password, user.passwordHash);

    if (!passwordValid) {
      return res.status(401).json({ message: "Invalid Credentials" });
    }

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = await hashValue(refreshToken);

    const session = await SessionModel.create({
      userId: user._id,
      refreshTokenHash,
      userAgent: req.headers["user-agent"] ?? "unknown",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    const accessToken = signAccessToken(
      { sub: user._id.toString(), sessionId: session._id.toString() },
      env.JWT_SECRET,
      "15m"
    );

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
      })
      .json({ success: true });
  } catch (error) {
    next(error);
  }
});


// refresh token
authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const sessions = await SessionModel.find({
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    const session = await Promise.any(
      sessions.map(async (s) => {
        const match = await verifyHash(refreshToken, s.refreshTokenHash);
        return match ? s : Promise.reject();
      })
    );

    const newRefreshToken = generateRefreshToken();
    session.refreshTokenHash = await hashValue(newRefreshToken);
    await session.save();

    const accessToken = signAccessToken(
      { sub: session.userId.toString(), sessionId: session._id.toString() },
      env.JWT_SECRET,
      "15m"
    );

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
      })
      .json({ success: true });
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
});


// logout token
authRouter.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    const sessions = await SessionModel.find();
    for (const s of sessions) {
      if (await verifyHash(refreshToken, s.refreshTokenHash)) {
        s.revokedAt = new Date();
        await s.save();
        break;
      }
    }
  }

  res
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json({ success: true });
});
