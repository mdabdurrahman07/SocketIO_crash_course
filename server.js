// server.js
// Main server file - Express + MongoDB (Socket.IO will be added in videos)

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { connectDB, closeDB } from "./config/database.js";
import { Server } from "socket.io";
import http from "http";
import orderRoutes from "./routes/orderRoutes.js";
import { orderHandler } from "./socket/orderHandler.js";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  orderHandler(io, socket);
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// REST API ROUTES
// ==========================================

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// API ROUTES
// ==========================================
app.use("/api/orders", orderRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ==========================================
// ERROR HANDLING
// ==========================================

process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Rejection:", reason);
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("\n👋 Shutting down gracefully...");
  await closeDB();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║  🚀 Server Running                     ║
║  📡 Port: ${PORT}                         ║
║  🌐 http://localhost:${PORT}              ║
║  📊 MongoDB: Connected                 ║
╚════════════════════════════════════════╝
    `);
      console.log("📝 API Endpoints:");
      console.log(`   GET  /health`);
      console.log(`   GET  /api/orders`);
      console.log(`   GET  /api/orders/:orderId`);
      console.log("\n✨ Ready! time to explore Socket.IO \n");
    });
  })
  .catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
