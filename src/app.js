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
      if (!roomName || !userName) {
        socket.emit("error", "Invalid Data");
        return;
      }
      userName = userName.toString().trim().toLowerCase();
      roomName = roomName.toString().trim().toLowerCase();

      const isRoomNameExist = await Room.findOne({ roomName: roomName });

      if (isRoomNameExist) {
        socket.emit("error", "Room already exists");
        return;
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
      newRoom.roomSize = newRoom.players.length;
      if (newRoom.creatorName !== userName) {
        newRoom.creatorName = userName;
      }
      await newRoom.save();

      console.log(`${newUser.userName} created the ${newRoom.roomName}`);
      socket.join(newRoom.roomName);
      socket.emit("room-created", {
        room: newRoom,
        user: newUser,
      });
    } catch (error) {
      console.error(`Error creating room: ${error.message}`);
      socket.emit("error", "An error occurred while creating the room");
    }
  });
  socket.on(
    "ask-to-join",
    async ({ userName, roomName, sdpOffer, iceCandidate }) => {
      try {
        if (!roomName || !userName || !sdpOffer || !iceCandidate) {
          socket.emit("error", "Invalid Data");
          return;
        }
        userName = userName.toString().trim().toLowerCase();
        roomName = roomName.toString().trim().toLowerCase();

        const room = await Room.findOne({ roomName: roomName });

        if (!room) {
          socket.emit("error", `No room exist by the name: ${roomName}`);
          return;
        }
        for (const player of room.players) {
          const p = await User.findById(player);
          if (p.userName === userName) {
            console.log(`${p.userName} already in room ${room.roomName}`);
            socket.to(room.roomName).emit("asking-to-join", {
              userName,
              roomName,
              socketId: socket.id,
              sdpOffer,
              iceCandidate,
            });
            return;
          }
        }
        if (room.roomSize > 1) {
          socket.emit("error", "Room has no space");
          return;
        }
        socket.to(room.roomName).emit("asking-to-join", {
          userName,
          roomName,
          socketId: socket.id,
          sdpOffer,
          iceCandidate,
        });
      } catch (error) {
        console.error(`Error joining room: ${error.message}`);
        socket.emit("error", "An error occurred while joining the room");
      }
    }
  );
  socket.on(
    "send-answer",
    async ({ roomName, userName, socketId, sdpAnswer, iceCandidate }) => {
      try {
        if (
          !roomName ||
          !userName ||
          !socketId ||
          !sdpAnswer ||
          !iceCandidate
        ) {
          socket.emit("error", "Invalid Data");
          return;
        }
        userName = userName.toString().trim().toLowerCase();
        roomName = roomName.toString().trim().toLowerCase();
        socket
          .to(socketId)
          .emit("answer", { sdpAnswer, iceCandidate, userName, roomName });
      } catch (error) {
        console.error(`Error joining room: ${error.message}`);
        socket.emit("error", "An error occurred while joining the room");
      }
    }
  );

  socket.on("join-room", async ({ userName, roomName }) => {
    try {
      if (!roomName || !userName) {
        socket.emit("error", "Invalid Data");
        return;
      }

      userName = userName.toString().trim().toLowerCase();
      roomName = roomName.toString().trim().toLowerCase();

      const room = await Room.findOne({ roomName: roomName });

      if (!room) {
        socket.emit("error", `No room exist by the name: ${roomName}`);
        return;
      }

      for (const player of room.players) {
        const p = await User.findById(player);
        if (p.userName === userName) {
          console.log(`${p.userName} already in room ${room.roomName}`);
          socket.broadcast.to(room.roomName).emit("joined", { userName });
          socket.join(room.roomName);
          socket.emit("joined-room", {
            room: room,
            user: p,
          });
          return;
        }
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
      room.roomSize = room.players.length;
      if (room.creatorName !== userName) {
        room.opponentName = userName;
      }
      await room.save();

      console.log(`${newUser.userName} join the room ${room.roomName}`);

      socket.join(room.roomName);
      socket.broadcast.to(room.roomName).emit("joined", { userName });
      socket.emit("joined-room", {
        room: room,
        user: newUser,
      });
    } catch (error) {
      console.error(`Error joining room: ${error.message}`);
      socket.emit("error", "An error occurred while joining the room");
    }
  });

  socket.on("leave-room", async ({ roomName, userId }) => {
    try {
      if (!roomName || !userId) {
        socket.emit("error", "Invalid Data");
        return;
      }
      roomName = roomName.toString().trim().toLowerCase();

      const room = await Room.findOne({ roomName });

      if (!room) {
        socket.emit("error", `No room exists with the name: ${roomName}`);
        return;
      }

      const updatedRoom = await Room.findOneAndUpdate(
        { roomName },
        { $pull: { players: userId } },
        { new: true }
      );
      await User.findByIdAndDelete(userId);
      updatedRoom.roomSize = updatedRoom.players.length;
      await updatedRoom.save();
      if (updatedRoom.roomSize == 0) {
        await Room.findByIdAndDelete(updatedRoom.id);
      }
    } catch (error) {
      console.error(`Error leaving room: ${error.message}`);
      socket.emit("error", "An error occurred while leaving the room");
    }
  });
  socket.on(
    "send-updated-board",
    async ({ roomName, chessBoard, senderColor }) => {
      try {
        if (!roomName || !chessBoard || !senderColor) {
          socket.emit("error", "Invalid Data");
          return;
        }
        roomName = roomName.toString().trim().toLowerCase();

        const room = await Room.findOne({ roomName });

        if (!room) {
          socket.emit("error", `No room exists with the name: ${roomName}`);
          return;
        }

        const turn = senderColor === "white" ? "black" : "white";
        room.currentCondition = chessBoard;
        room.currentTurn = turn;

        console.log(
          `Saving board: ${chessBoard}   ${turn} in ${room.roomName}`
        );

        await room.save();

        io.to(room.roomName).emit("newBoard", { room });
      } catch (error) {
        console.error("Error sending new board:", error);
        socket.emit("error", "An error occurred while updating the board");
      }
    }
  );
  // socket.on("send-answer", async ({ roomName, sdpAnswer }) => {
  //   try {
  //     if (!roomName || !sdpAnswer) {
  //       socket.emit("error", "Invalid Data");
  //       return;
  //     }
  //     roomName = roomName.toString().trim().toLowerCase();

  //     const room = await Room.findOne({ roomName });

  //     if (!room) {
  //       socket.emit("error", `No room exists with the name: ${roomName}`);
  //       return;
  //     }
  //     console.log("Sending Answer to give offer");
  //     socket.broadcast.to(room.roomName).emit("answered", { sdpAnswer });
  //   } catch (error) {
  //     console.error("Error sending new board:", error);
  //     socket.emit("error", "An error occurred while updating the board");
  //   }
  // });
  // socket.on("IceCandidateA", async ({ roomName, iceCandidate }) => {
  //   try {
  //     if (!roomName || !iceCandidate) {
  //       socket.emit("error", "Invalid Data");
  //       return;
  //     }
  //     roomName = roomName.toString().trim().toLowerCase();

  //     const room = await Room.findOne({ roomName });

  //     if (!room) {
  //       socket.emit("error", `No room exists with the name: ${roomName}`);
  //       return;
  //     }
  //     console.log("Sending first ice candidates to give answerr");

  //     socket.broadcast
  //       .to(room.roomName)
  //       .emit("first-IceCandidate", { iceCandidate });
  //   } catch (error) {
  //     console.error("Error sending new board:", error);
  //     socket.emit("error", "An error occurred while updating the board");
  //   }
  // });
  // socket.on("IceCandidateB", async ({ roomName, iceCandidate }) => {
  //   try {
  //     if (!roomName || !iceCandidate) {
  //       socket.emit("error", "Invalid Data");
  //       return;
  //     }
  //     roomName = roomName.toString().trim().toLowerCase();

  //     const room = await Room.findOne({ roomName });

  //     if (!room) {
  //       socket.emit("error", `No room exists with the name: ${roomName}`);
  //       return;
  //     }
  //     console.log("Sending second ice candidates to give first ice candidates");
  //     socket.broadcast
  //       .to(room.roomName)
  //       .emit("second-IceCandidate", { iceCandidate });
  //   } catch (error) {
  //     console.error("Error sending new board:", error);
  //     socket.emit("error", "An error occurred while updating the board");
  //   }
  // });

  socket.on("game-alert", async ({ roomName, title, content }) => {
    try {
      if (!roomName || !title || !content) {
        socket.emit("error", "Invalid Data");
        return;
      }
      roomName = roomName.toString().trim().toLowerCase();

      const room = await Room.findOne({ roomName });

      if (!room) {
        socket.emit("error", `No room exists with the name: ${roomName}`);
        return;
      }
      if (title === "Draw Proposal") {
        socket.broadcast.to(room.roomName).emit("newAlert", { title, content });
      } else {
        io.to(room.roomName).emit("newAlert", { title, content });
      }
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
