import { acceptBid } from "../services/auction-engine.js";

// Track users in auction rooms: { auctionId: Map<socketId, { userId, userName }> }
const auctionRooms = new Map();

export const registerAuctionHandlers = (io, socket) => {
  // Use verified identity from socket auth middleware
  const userId = socket.user.id;
  const userName = socket.user.name;

  // Join auction room
  socket.on("auction:join", ({ auctionId }) => {
    if (!auctionId) return;

    socket.join(auctionId);

    if (!auctionRooms.has(auctionId)) {
      auctionRooms.set(auctionId, new Map());
    }

    const room = auctionRooms.get(auctionId);
    room.set(socket.id, { userId, userName });

    // Broadcast to all users in room
    io.to(auctionId).emit("auction:userJoined", {
      userName,
      userId,
      activeUsers: getActiveUsers(auctionId),
    });

    console.log(`${userName} joined auction: ${auctionId}`);
  });

  // Leave auction room
  socket.on("auction:leave", ({ auctionId }) => {
    handleLeaveAuction(io, socket, auctionId);
  });

  // Place bid via socket — uses authenticated userId, not client-supplied
  socket.on("auction:bid", async ({ auctionId, bidAmount }) => {
    try {
      if (!auctionId || bidAmount == null) return;

      await acceptBid(auctionId, userId, Number(bidAmount));
    } catch (error) {
      console.error("Socket bid error:", error.message);
      socket.emit("auction:error", {
        message: error.message || "Error placing bid",
      });
    }
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    cleanupSocket(io, socket);
  });
};

const handleLeaveAuction = (io, socket, auctionId) => {
  if (!auctionId || !auctionRooms.has(auctionId)) return;

  const room = auctionRooms.get(auctionId);
  const userData = room.get(socket.id);

  if (userData) {
    room.delete(socket.id);

    // Remove empty rooms
    if (room.size === 0) {
      auctionRooms.delete(auctionId);
    }

    socket.leave(auctionId);

    io.to(auctionId).emit("auction:userLeft", {
      userName: userData.userName,
      userId: userData.userId,
      activeUsers: getActiveUsers(auctionId),
    });

    console.log(`${userData.userName} left auction: ${auctionId}`);
  }
};

const cleanupSocket = (io, socket) => {
  for (const [auctionId, room] of auctionRooms.entries()) {
    if (room.has(socket.id)) {
      handleLeaveAuction(io, socket, auctionId);
    }
  }
};

const getActiveUsers = (auctionId) => {
  const room = auctionRooms.get(auctionId);
  if (!room) return [];

  const users = [];
  const seen = new Set();

  for (const { userId, userName } of room.values()) {
    if (!seen.has(userId)) {
      seen.add(userId);
      users.push({ userId, userName });
    }
  }

  return users;
};
