import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomName: {
      type: String,
      required: true,
    },
    creatorName: {
      type: String,
      default: "Player 1",
    },
    opponentName: {
      type: String,
      default: "Player 2",
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
    offer: { type: Object, required: true },
    candidate: { type: Object },
  },
  { timestamps: true }
);

export const Room = mongoose.model("Room", roomSchema);
