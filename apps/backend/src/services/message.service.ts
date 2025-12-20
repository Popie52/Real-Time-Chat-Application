import { Types } from "mongoose";
import { ConversationModel } from "../models/conversation.model";
import { MessageModel } from "../models/message.model";

export const createMessage = async ({
  conversationId,
  senderId,
  content,
}: {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
}) => {
  const conversation = await ConversationModel.findOneAndUpdate(
    { _id: conversationId },
    { $inc: { lastSequence: 1 } },
    { new: true }
  ); // updated object milega

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  return MessageModel.create({
    conversationId,
    senderId,
    sequence: conversation.lastSequence,
    content,
  });
};

// Pagination Strategy
// MessageModel.find({
//   conversationId,
//   sequence: { $lt: lastSeenSequence },
//   deletedAt: { $exists: false },
// });
