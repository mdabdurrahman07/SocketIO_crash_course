import { getCollection } from "../config/database.js";
import {
  calculateTotalPrice,
  createOrderDocument,
  generateOrderId,
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
        return callBack({ success: false, message: "order not fine" });
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
    } catch (error) {}
  });
};
