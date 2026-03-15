import { validateOrder } from "../utils/helper.js";

export const orderHandler = (io, socket) => {
  console.log("socket is connected", socket.id);
  //   place oder
  socket.on("placeOrder", (data, callBack) => {
    try {
      console.log(`placed order from ${socket.id}`);
      const validation = validateOrder(data);
      if (!validation.valid) {
        return callBack({ success: false, message: validation.message });
      }
    } catch (error) {
      console.log("order placed related error", error);
    }
  });
};
