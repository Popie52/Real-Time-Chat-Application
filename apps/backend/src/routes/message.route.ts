import { Router } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth.middleware";
import { MessageModel } from "../models/message.model";
import { Types } from "mongoose";

export const messageRouter = Router();

messageRouter.get(
  "/conversations/:id/messages/sync",
  requireAuth,
  async (req: AuthRequest, res) => {
    const conversationId = new Types.ObjectId(req.params.id);
    const afterSequence = Number(req.query.afterSequence ?? 0);

    const messages = await MessageModel.find({
      conversationId,
      sequence: { $gt: afterSequence },
      deletedAt: { $exists: false },
    })
      .sort({ sequence: 1 })
      .limit(500);

    res.json({ messages });
  }
);
