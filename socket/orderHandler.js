import { getCollection } from "../config/database.js";
import {
  calculateTotalPrice,
  createOrderDocument,
  generateOrderId,
  isValidStatusTransition,
  validateOrder,
} from "../utils/helper.js";

export const orderHandler = (io, socket) => {
  console.log("socket is connected", socket.id);
  //   place oder
  socket.on("placeOrder", async (data, callBack) => {
    try {
      console.log(`placed order from ${socket.id}`);
      const validation = validateOrder(data);
      if (!validation.valid) {
        return callBack({ success: false, message: validation.message });
      }
      const totals = calculateTotalPrice(data.items);
      const orderId = generateOrderId();
      const order = createOrderDocument(data, orderId, totals);
      const orderCollection = getCollection("orders");

      await orderCollection.insertOne(order);
      socket.join(`order-${orderId}`);
      socket.join("customers");
      io.to("admins").emit("newOrder", { order });
      callBack({ success: true, order });
      console.log(`order created: ${orderId}`);
    } catch (error) {
      console.log("order placed related error", error);
      callBack({ success: false, message: "order failed" });
    }
  });
  // track order
  socket.on("trackOrder", async (data, callBack) => {
    try {
      const orderCollection = getCollection("orders");
      const order = await orderCollection.findOne({
        orderId: data.orderId,
      });
      if (!order) {
        return callBack({ success: false, message: "order not found" });
      }
      socket.join(`order-${data.orderId}`);
      callBack({
        success: true,
        order,
      });
    } catch (error) {
      console.error("order tracking error", error);
      callBack({
        success: false,
        message: error.message,
      });
    }
  });
  // cancel order
  socket.on("cancelOrder", async (data, callBack) => {
    try {
      const orderCollection = getCollection("orders");
      const order = await orderCollection.findOne({
        orderId: data.orderId,
      });
      if (!order) {
        return callBack({ success: false, message: "order not fine" });
      }
      if (!["pending", "confirmed"].includes(order.status)) {
        return callBack({
          success: false,
          message: "Can not cancel the order",
        });
      }
      await orderCollection.updateOne(
        { orderId: data.orderId } <
          {
            $set: { status: "cancelled", updatedAt: new Date() },
            $push: {
              statusHistory: {
                status: "cancelled",
                timestamp: new Date(),
                by: socket.id,
                note: data.reason || "",
              },
            },
          },
      );
      io.to(`order-${data.orderId}`).emit("orderCancelled", {
        orderId: data.orderId,
      });
      io.to("admins").emit("orderCancelled", {
        orderId: data.orderId,
        customerName: order.customerName,
      });
      callBack({
        success: true,
      });
    } catch (error) {
      console.error("Cancel order error", error);
      callBack({
        success: false,
        message: error.message,
      });
    }
  });
  // get my orders
  socket.on("getMyOrders", async (data, callBack) => {
    try {
      const orderCollection = getCollection("orders");
      const orders = await orderCollection
        .find({
          customerPhone: data.customerPhone,
        })
        .sort({
          createdAt: -1,
        })
        .limit(20)
        .toArray();
      callBack({ success: true, orders });
    } catch (error) {
      console.error("getMyOrders error", error);
      callBack({
        success: false,
        message: error.message,
      });
    }
  });
  // admin events starts

  // admin login
  socket.on("adminLogin", async (data, callBack) => {
    try {
      if (data.password === process.env.ADMIN_PASSWORD) {
        socket.isAdmin = true;
        socket.join("admins");
        callBack({ success: true });
        console.log(`admin logged in: ${socket.id}`);
      } else {
        callBack({ success: false, message: "invalid password" });
      }
    } catch (error) {
      callBack({
        success: false,
        message: "login failed",
      });
    }
  });

  // admin side get all orders
  socket.on("getAllOrders", async (data, callBack) => {
    try {
      if (!socket.isAdmin) {
        return callBack({ success: false, message: "Unauthorized" });
      }
      const orderCollection = getCollection("orders");
      const filter = data?.status ? { status: data.status } : {};
      const orders = await orderCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
      callBack({
        success: true,
        orders,
      });
    } catch (error) {
      console.error(error);
      callBack({ success: false, message: "failed to load orders" });
    }
  });
  // admin updateOrderStatus
  socket.on("updateOrderStatus", async (data, callBack) => {
    try {
      const orderCollection = getCollection("orders");
      const order = await orderCollection.findOne({
        orderId: data.orderId,
      });
      if (!order) {
        return callBack({ success: false, message: "order not found" });
      }
      if (!isValidStatusTransition(order.status, data.newStatus)) {
        return callBack({
          success: false,
          message: "Invalid status transaction",
        });
      }
      const result = await orderCollection.findOneAndUpdate(
        { orderId: data.orderId },
        {
          $set: { status: data.newStatus, updatedAt: new Date() },
          $push: {
            statusHistory: {
              status: data.newStatus,
              timestamp: new Date(),
              by: socket.id,
              note: "Status updated by admin",
            },
          },
        },
        { returnDocument: "after" },
      );
      io.to(`order-${data.orderId}`).emit("statusUpdated", {
        orderId: data.orderId,
        status: data.newStatus,
        order: result,
      });
      socket.to("admin").emit("orderStatusChanged", {
        orderId: data.orderId,
        newStatus: data.newStatus,
      });
      callBack({ success: true });
    } catch (error) {
      callBack({
        success: false,
        message: "failed to update order status",
      });
    }
  });
  // acceptOrder
  socket.on("acceptOrder", async (data, callBack) => {
    try {
      if (!socket.isAdmin) {
        return callBack({ success: false, message: "Unauthorized" });
      }
      const orderCollection = getCollection("orders");
      const order = await orderCollection.findOne({ orderId: data.orderId });
      if (!order || order.status !== "pending") {
        return callBack({
          success: false,
          message: "Can not accept this order",
        });
      }
      const estimatedTime = data.estimatedTime || 30;
      const result = await orderCollection.findOneAndUpdate(
        { orderId: data.orderId },
        {
          $set: { status: "confirmed", estimatedTime, updatedAt: new Date() },
          $push: {
            statusHistory: {
              status: "confirmed",
              timestamp: new Date(),
              by: socket.id,
              note: `Accepted with ${estimatedTime} min estimated time`,
            },
          },
        },
        {
          returnDocument: "after",
        },
      );
      io.to(`order-${data.orderId}`).emit("orderAccepted", {
        orderId: data.orderId,
        estimatedTime,
      });
      socket
        .to("admins")
        .emit("orderAcceptedByAdmin", { orderId: data.orderId });
      callBack({ success: true, order: result });
    } catch (error) {
      console.error(error.message);
      callBack({
        success: false,
        message: "failed to accept order",
      });
    }
  });
};
