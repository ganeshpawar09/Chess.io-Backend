import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
    },
    socketId: {
      type: String,
    },
    lastRoomName: {
      type: String,
    },

    lastGameColor: {
      type: String,
    },
  },
  { timestamps: true }
);
export const User = mongoose.model("User", userSchema);
