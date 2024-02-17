import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import express from "express";
import dotenv from "dotenv";
dotenv.config({
  path: "C:/Users/gapaw/Desktop/Online Chess/onlinechess_backend/.env",
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

server.listen(process.env.PORT || 8000, () => {
  console.log(`Server is listening on port ${process.env.PORT || 8000}`);
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", async ({ roomName }) => {
    try {
      socket.join(roomName);
      socket.broadcast.to(roomName).emit("newMemberInChat");
      console.log(`${socket.id} is connected to ${roomName    }`);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  });
  socket.on("sendNewBoard", async ({ roomName, chessBoard, color }) => {
    try {
      socket.broadcast.to(roomName).emit("newBoard", { chessBoard, color });
    } catch (error) {
      console.error("Error storing message:", error);
    }
  });

  socket.on("user_disconnect", async ({ roomName }) => {
    try {
      socket.leave(roomName);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket id: ${socket.id} is disconnected`);
  });
});
