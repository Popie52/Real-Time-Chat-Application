import { Schema, model, Types } from "mongoose";

export interface ReadState {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  lastReadSequence: number;
  updatedAt: Date;
}

const readStateSchema = new Schema<ReadState>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    lastReadSequence: {
      type: Number,
      required: true,
    },
  },
  { timestamps: { updatedAt: true, createdAt: false } }
);

readStateSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true }
);

export const ReadStateModel = model<ReadState>(
  "ReadState",
  readStateSchema
);
