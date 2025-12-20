import { Server } from "socket.io";
import http from "http";
import { verifyAccessToken } from "../utils/token";
import { SessionModel } from "../models/session.model";
import { env } from "../config/env";
import { ConversationModel } from "../models/conversation.model";
import { createMessage } from "../services/message.service";
import { Types } from "mongoose";
import { ReadStateModel } from "../models/read-state.model";

export interface SocketContext {
  userId: string;
  sessionId: string;
}

export const createSocketServer = (server: http.Server) => {
  const typingState = new Map<string, NodeJS.Timeout>();

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

  io.on("connection", async (socket) => {
    const ctx = socket.data.auth as SocketContext;
    const { userId } = ctx;

    console.log(
      `Socket connected: user=${ctx.userId}, session=${ctx.sessionId}`
    );

    const conversations = await ConversationModel.find({
      participantIds: userId,
    }).select("_id");

    for (const c of conversations) {
      socket.join(c._id.toString());
    }

    socket.on(
      "message:send",
      async (payload: { conversationId: string; content: string }) => {
        const { userId } = socket.data.auth;

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
      console.log(
        `Socket disconnected: user=${ctx.userId}, session=${ctx.sessionId}`
      );
    });
  });
  return io;
};
