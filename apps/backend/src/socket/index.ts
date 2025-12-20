import { Server } from "socket.io";
import http from "http";
import { verifyAccessToken } from "../utils/token";
import { SessionModel } from "../models/session.model";
import { env } from "../config/env";
import { ConversationModel } from "../models/conversation.model";
import { createMessage } from "../services/message.service";
import { Types } from "mongoose";
import { ReadStateModel } from "../models/read-state.model";
import { logger } from "@backend/utils/logger";

export interface SocketContext {
  userId: string;
  sessionId: string;
}

export const createSocketServer = (server: http.Server) => {
  const typingState = new Map<string, NodeJS.Timeout>();
  const messageBuckets = new Map<string, { count: number; resetAt: number }>();
  const typingCooldown = new Map<string, number>();

  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  const connectionAttempts = new Map<string, number[]>();

  io.use((socket, next) => {
    const sessionId = socket.handshake.auth?.sessionId;
    if (!sessionId) return next();

    const now = Date.now();
    const attempts = connectionAttempts.get(sessionId) ?? [];

    const recent = attempts.filter((ts) => now - ts < 60_000);
    recent.push(now);

    if (recent.length > 5) {
      return next(new Error("Too many connections"));
    }

    connectionAttempts.set(sessionId, recent);
    next();
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

  io.on("connection", async (socket) => {
    const ctx = socket.data.auth as SocketContext;
    const { userId } = ctx;

    // console.log(
    //   `Socket connected: user=${ctx.userId}, session=${ctx.sessionId}`
    // );
    logger.info(
      { userId: ctx.userId, sessionId: ctx.sessionId },
      "Socket connected"
    );

    const conversations = await ConversationModel.find({
      participantIds: userId,
    }).select("_id");

    for (const c of conversations) {
      socket.join(c._id.toString());
    }

    const MAX_MESSAGES = 20;
    const WINDOW_MS = 10_000;

    socket.on(
      "message:send",
      async (payload: { conversationId: string; content: string }) => {
        const { userId, sessionId } = socket.data.auth;
        const key = `${userId}:${sessionId}`;
        const now = Date.now();

        const bucket = messageBuckets.get(key);

        if (!bucket || bucket.resetAt < now) {
          messageBuckets.set(key, {
            count: 1,
            resetAt: now + WINDOW_MS,
          });
        } else {
          if (bucket.count >= MAX_MESSAGES) {
            return socket.emit("error:rate-limit", {
              type: "message",
              retryAfter: bucket.resetAt - now,
            });
          }
          bucket.count++;
        }

        const message = await createMessage({
          conversationId: new Types.ObjectId(payload.conversationId),
          senderId: new Types.ObjectId(userId),
          content: payload.content,
        });

        io.to(payload.conversationId).emit("message:new", {
          id: message._id.toString(),
          conversationId: message.conversationId.toString(),
          senderId: message.senderId.toString(),
          sequence: message.sequence,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        });
      }
    );

    socket.on(
      "conversation:read",
      async (payload: { conversationId: string; lastReadSequence: number }) => {
        const { userId } = socket.data.auth;

        const state = await ReadStateModel.findOneAndUpdate(
          {
            conversationId: new Types.ObjectId(payload.conversationId),
            userId: new Types.ObjectId(userId),
            lastReadSequence: { $lt: payload.lastReadSequence },
          },
          {
            lastReadSequence: payload.lastReadSequence,
          },
          { upsert: true, new: true }
        );

        if (!state) return;

        socket.to(payload.conversationId).emit("conversation:read:update", {
          conversationId: payload.conversationId,
          userId,
          lastReadSequence: state.lastReadSequence,
        });
      }
    );

    socket.on("typing:start", (payload: { conversationId: string }) => {
      const { userId } = socket.data.auth;
      const key = `${payload.conversationId}:${userId}`;
      //   const key = `${payload.conversationId}:${userId}`;
      const now = Date.now();

      if (typingCooldown.get(key) && now - typingCooldown.get(key)! < 1000) {
        return;
      }

      typingCooldown.set(key, now);

      if (!typingState.has(key)) {
        socket.to(payload.conversationId).emit("typing:update", {
          conversationId: payload.conversationId,
          userId,
          isTyping: true,
        });
      }

      if (typingState.has(key)) {
        clearTimeout(typingState.get(key)!);
      }

      const timeout = setTimeout(() => {
        typingState.delete(key);
        socket.to(payload.conversationId).emit("typing:update", {
          conversationId: payload.conversationId,
          userId,
          isTyping: false,
        });
      }, 3000);

      typingState.set(key, timeout);
    });

    socket.on("typing:stop", (payload: { conversationId: string }) => {
      const { userId } = socket.data.auth;
      const key = `${payload.conversationId}:${userId}`;

      if (typingState.has(key)) {
        clearTimeout(typingState.get(key)!);
        typingState.delete(key);

        socket.to(payload.conversationId).emit("typing:update", {
          conversationId: payload.conversationId,
          userId,
          isTyping: false,
        });
      }
    });

    socket.on("disconnect", () => {
      const { userId } = socket.data.auth;

      for (const [key, timeout] of typingState.entries()) {
        if (key.endsWith(`:${userId}`)) {
          clearTimeout(timeout);
          typingState.delete(key);

          const conversationId = key.split(":")[0];
          socket.to(conversationId).emit("typing:update", {
            conversationId,
            userId,
            isTyping: false,
          });
        }
      }
      const { sessionId } = socket.data.auth;
      messageBuckets.delete(`${userId}:${sessionId}`);

      console.log(
        `Socket disconnected: user=${ctx.userId}, session=${ctx.sessionId}`
      );
    });
  });
  return io;
};
