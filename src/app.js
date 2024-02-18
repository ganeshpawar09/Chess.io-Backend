import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { Room } from "./models/room.model.js";
import { User } from "./models/user.model.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

io.on("connection", (socket) => {
  console.log(`New connection to server ${socket.id}`);

  socket.on("create-room", async ({ userName, roomName }) => {
    try {
      const isRoomNameExist = await Room.findOne({ roomName: roomName });

      if (isRoomNameExist) {
        if (isRoomNameExist.roomSize > 0) {
          socket.emit("error", "Room already exists");
          return;
        }
      }

      const newRoom = await Room.create({
        roomName,
        roomSize: 0,
        currentCondition:
          "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        currentTurn: "white",
        gameIsOver: false,
      });

      if (!newRoom) {
        socket.emit("error", "Something went wrong while creating room");
        return;
      }

      const newUser = await User.create({
        userName,
        socketId: socket.id,
        lastRoomName: roomName,
        lastGameColor: "white",
      });

      if (!newUser) {
        socket.emit("error", "Something went wrong while creating user");
        return;
      }

      newRoom.players.push(newUser);
      newRoom.roomSize = newRoom.roomSize + 1;
      await newRoom.save();

      socket.emit("room-created", {
        roomName: newRoom.roomName,
        user: newUser,
      });
    } catch (error) {
      console.error(`Error creating room: ${error.message}`);
      socket.emit("error", "An error occurred while creating the room");
    }
  });
  socket.on("join-room", async ({ userName, roomName }) => {
    try {
      const room = await Room.findOne({ roomName: roomName });

      if (!room) {
        socket.emit("error", `No room exist by the name: ${roomName}`);
        return;
      }
      if (room.roomSize > 1) {
        socket.emit("error", "Room has no space");
        return;
      }

      const newUser = await User.create({
        userName,
        socketId: socket.id,
        lastRoomName: roomName,
        lastGameColor: "black",
        lastGameIsOver: false,
      });

      if (!newUser) {
        socket.emit("error", "Something went wrong while creating user");
        return;
      }

      room.players.push(newUser);
      room.roomSize = room.roomSize + 1;
      await room.save();
      console.log("new member join");
      io.to(roomName).emit("newMemeberJoin", {
        roomName: room.roomName,
        user: newUser,
      });
    } catch (error) {
      console.error(`Error joining room: ${error.message}`);
      socket.emit("error", "An error occurred while joining the room");
    }
  });

  socket.on("leave-room", async ({ roomName, userName }) => {
    try {
      const room = await Room.findOne({ roomName });

      if (!room) {
        socket.emit("error", `No room exists with the name: ${roomName}`);
        return;
      }

      room.players = room.players.filter((user) => user.userName !== userName);
      await room.save();

      console.log(`${userName} successfully exited from ${roomName}`);
    } catch (error) {
      console.error(`Error leaving room: ${error.message}`);
      socket.emit("error", "An error occurred while leaving the room");
    }
  });

  socket.on(
    "send-updated-board",
    async ({ roomName, chessBoard, senderColor }) => {
      try {
        const room = await Room.findOne({ roomName });

        if (!room) {
          socket.emit("error", `No room exists with the name: ${roomName}`);
          return;
        }

        const turn = senderColor === "white" ? "black" : "white";
        room.currentCondition = chessBoard;
        room.currentTurn = turn;

        console.log(`Saving board: ${chessBoard}   ${turn}`);

        await room.save();

        socket.broadcast.to(roomName).emit("newBoard", { chessBoard, turn });
      } catch (error) {
        console.error("Error sending new board:", error);
        socket.emit("error", "An error occurred while updating the board");
      }
    }
  );
  socket.on("rejoin-room", async ({ roomName, userName }) => {
    try {
      const room = await Room.findOne({ roomName });

      if (!room) {
        socket.emit("error", `No room exists with the name: ${roomName}`);
        return;
      }

      let user = null;

      for (const player of room.players) {
        const p = await User.findById(player);
        if (p.userName === userName) {
          user = p;
          break;
        }
      }

      if (!user) {
        socket.emit("error", `User ${userName} not found in room ${roomName}`);
        return;
      }

      console.log(`${userName} rejoined room ${roomName}`);

      socket.emit("rejoin-successful", { room, user });
      socket.join(roomName);
    } catch (error) {
      console.error("Error during rejoin:", error);
      socket.emit("error", "An error occurred during rejoin");
    }
  });

  socket.on("game-over", async ({ roomName }) => {
    try {
      const room = await Room.findOne({ roomName });

      if (!room) {
        socket.emit("error", `No room exists with the name: ${roomName}`);
        return;
      }

      room.gameIsOver = true;
      await room.save();

      console.log(`${roomName}s game is over`);
    } catch (error) {
      console.error(`Error while setting gameover: ${error.message}`);
      socket.emit("error", "An error occurred while setting gameover");
    }
  });

  socket.on("disconnect", () => {
    console.log(`${socket.id} successfully disconnected`);
  });
});

export { server };
