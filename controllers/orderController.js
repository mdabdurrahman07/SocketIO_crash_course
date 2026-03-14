// controllers/orderController.js
// Order business logic - controller layer

import { getCollection } from "../config/database.js";

/**
 * Get all orders
 */
export const getAllOrders = async (req, res) => {
  try {
    const ordersCollection = getCollection("orders");
    const orders = await ordersCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get single order by ID
 */
export const getOrderById = async (req, res) => {
  try {
    const ordersCollection = getCollection("orders");
    const order = await ordersCollection.findOne({
      orderId: req.params.orderId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
