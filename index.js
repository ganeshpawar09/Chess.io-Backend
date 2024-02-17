import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({
  path: "C:/Users/gapaw/Desktop/Online Chess/onlinechess_backend/.env",
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*", // Provide a default value
  },
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", // Provide a default value
    credentials: true,
  })
);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", ({ roomName }) => {
    try {
      socket.join(roomName);
      socket.broadcast.to(roomName).emit("newMemberInChat");
      console.log(`${socket.id} is connected to ${roomName}`);
    } catch (error) {
      console.error("Error joining room:", error);
    }
  });

  socket.on("sendNewBoard", ({ roomName, chessBoard, color }) => {
    try {
      socket.broadcast.to(roomName).emit("newBoard", { chessBoard, color });
    } catch (error) {
      console.error("Error sending new board:", error);
    }
  });

  socket.on("user_disconnect", ({ roomName }) => {
    try {
      socket.leave(roomName);
    } catch (error) {
      console.error("Error disconnecting user:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket id: ${socket.id} is disconnected`);
  });
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
