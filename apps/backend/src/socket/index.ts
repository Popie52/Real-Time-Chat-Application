import { Server } from "socket.io";
import http from "http";
import { verifyAccessToken } from "../utils/token";
import { SessionModel } from "../models/session.model";
import { env } from "../config/env";

export interface SocketContext {
  userId: string;
  sessionId: string;
}

export const createSocketServer = (server: http.Server) => {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.accessToken ||
        socket.handshake.headers.cookie
          ?.split("; ")
          .find((c) => c.startsWith("accessToken="))
          ?.split("=")[1];

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const payload = verifyAccessToken(token, env.JWT_SECRET);

      const session = await SessionModel.findOne({
        _id: payload.sessionId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        return next(new Error("Session Invalid"));
      }

      socket.data.auth = {
        userId: payload.sub,
        sessionId: payload.sessionId,
      } satisfies SocketContext;
      next();
    } catch (error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const ctx = socket.data.auth as SocketContext;

    console.log(
      `Socket connected: user=${ctx.userId}, session=${ctx.sessionId}`
    );

    socket.on("disconnect", () => {
      console.log(
        `Socket disconnected: user=${ctx.userId}, session=${ctx.sessionId}`
      );
    });
  });
  return io;
};
