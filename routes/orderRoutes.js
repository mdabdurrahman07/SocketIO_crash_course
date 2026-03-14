// routes/orderRoutes.js
// Order API routes

import express from "express";
import { getAllOrders, getOrderById } from "../controllers/orderController.js";

const router = express.Router();

// Routes
router.get("/", getAllOrders);           // GET /api/orders
router.get("/:orderId", getOrderById);   // GET /api/orders/:orderId

export default router;
