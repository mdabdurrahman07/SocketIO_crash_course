export const orderHandler = (io, socket) => {
  console.log("socket is connected", socket.id);
  //   place oder
  socket.on("placeOrder", (data, callBack) => {
    try {
      console.log(`placed order from ${socket.id}`);
    } catch (error) {
      console.log("order placed related error", error);
    }
  });
};
