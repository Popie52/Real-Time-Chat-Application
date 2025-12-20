import { Schema, model, Types } from "mongoose";

export interface User {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);


export const UserModel = model<User>("User", userSchema);