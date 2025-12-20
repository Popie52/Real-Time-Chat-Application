import { Schema, Types, model } from "mongoose";

export interface Conversation {
  _id: Types.ObjectId;
  type: "dm" | "group";
  participantsIds: Types.ObjectId[];
  lastSequence: number;
  createdAt: Date;
}

const conversationSchema = new Schema<Conversation>(
  {
    type: {
      type: String,
      enum: ["dm", "group"],
      required: true,
    },
    participantsIds: {
      type: [Schema.Types.ObjectId],
      required: true,
      index: true,
    },
    lastSequence: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

export const ConversationModel = model<Conversation>(
  "Conversation",
  conversationSchema
);
