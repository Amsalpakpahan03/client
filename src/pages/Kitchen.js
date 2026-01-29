import React, { useEffect, useState, useRef } from "react";
import { OrderAPI } from "../api/order.api";
import socket from "../api/socket";

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const ordersRef = useRef([]);

  const sync = (data) => {
    setOrders(data);
    ordersRef.current = data;
  };

  useEffect(() => {
    OrderAPI.getAll().then(res => sync(res.data));
  }, []);

  useEffect(() => {
    const onNew = (order) => {
      if (!ordersRef.current.find(o => o._id === order._id)) {
        sync([order, ...ordersRef.current]);
      }
    };

    const onUpdate = (updated) => {
      if (updated.status === "paid") {
        sync(ordersRef.current.filter(o => o._id !== updated._id));
      } else {
        sync(
          ordersRef.current.map(o =>
            o._id === updated._id ? updated : o
          )
        );
      }
    };

    socket.on("order:new", onNew);
    socket.on("order:update", onUpdate);

    return () => {
      socket.off("order:new", onNew);
      socket.off("order:update", onUpdate);
    };
  }, []);

  /* ================= HANDLER ================= */

  const serveDrink = (orderId, itemId) => {
    OrderAPI.updateItemStatus(orderId, itemId, "served");
  };

  const cookFood = (orderId, itemId) => {
    OrderAPI.updateItemStatus(orderId, itemId, "cooking");
  };

  const serveFood = (orderId, itemId) => {
    OrderAPI.updateItemStatus(orderId, itemId, "served");
  };

  return (
    <div>
      <h1>🍳 Dapur</h1>

      {orders.map(order => {
        const foods = order.items.filter(i => i.category !== "Minuman");
        const drinks = order.items.filter(i => i.category === "Minuman");

        return (
          <div key={order._id} style={{ border: "1px solid #ccc", margin: 10, padding: 10 }}>
            <h3>🪑 Meja {order.tableNumber}</h3>

            {/* ================= MINUMAN ================= */}
            <h4>🥤 Minuman</h4>
            {drinks.map(i => (
              <div key={i._id}>
                {i.name} ({i.status})
                {i.status === "pending" && (
                  <button onClick={() => serveDrink(order._id, i._id)}>
                    Antar
                  </button>
                )}
              </div>
            ))}

            {/* ================= MAKANAN ================= */}
            <h4>🍔 Makanan</h4>
            {foods.map(i => (
              <div key={i._id}>
                {i.name} ({i.status})

                {i.status === "pending" && (
                  <button onClick={() => cookFood(order._id, i._id)}>
                    Masak
                  </button>
                )}

                {i.status === "cooking" && (
                  <button onClick={() => serveFood(order._id, i._id)}>
                    Antar
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default Kitchen;
