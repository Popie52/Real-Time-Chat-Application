import { Schema, Types, model } from "mongoose";

export interface Message {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  sequence: number;
  content: string;
  createdAt: Date;
  deletedAt?: Date;
}

const messageSchema = new Schema<Message>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sequence: {
      type: Number,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ conversationId: 1, sequence: 1 }, { unique: true });

export const MessageModel = model<Message>("Message", messageSchema);
