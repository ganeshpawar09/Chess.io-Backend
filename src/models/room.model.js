import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomName: {
      type: String,
      required: true,
    },
    roomSize: {
      type: Number,
      required: true,
      default: 0,
    },
    currentCondition: {
      type: String,
      required: true,
      default: "",
    },
    currentTurn: {
      type: String,
      required: true,
      default: "white",
    },
    gameIsOver: {
      type: Boolean,
      default: false,
    },
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

export const Room = mongoose.model("Room", roomSchema);
