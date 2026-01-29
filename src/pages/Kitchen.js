import React, { useEffect, useState } from "react";
import { OrderAPI } from "../api/order.api";
import socket from "../api/socket";

function Kitchen() {
  const [orders, setOrders] = useState([]);

  /* ================= LOAD AWAL ================= */
  useEffect(() => {
    OrderAPI.getAll().then(res => setOrders(res.data));
  }, []);

  /* ================= SOCKET REALTIME ================= */
  useEffect(() => {

    const onNewOrder = (order) => {
      setOrders(prev => {
        if (prev.some(o => o._id === order._id)) return prev;
        return [order, ...prev];
      });
    };

    const onUpdateOrder = (updated) => {
      setOrders(prev => {
        if (updated.status === "paid") {
          return prev.filter(o => o._id !== updated._id);
        }
        return prev.map(o => o._id === updated._id ? updated : o);
      });
    };

    socket.on("order:new", onNewOrder);
    socket.on("order:update", onUpdateOrder);

    return () => {
      socket.off("order:new", onNewOrder);
      socket.off("order:update", onUpdateOrder);
    };
  }, []);

  /* ================= ACTION ================= */
  const handleItemAction = async (orderId, itemId) => {
    await OrderAPI.updateItemStatus(orderId, itemId, "served");
  };

  const handleGlobalAction = async (id, status) => {
    const next = { pending: "cooking", cooking: "served", served: "paid" };
    if (next[status]) await OrderAPI.updateStatus(id, next[status]);
  };

  return (
    <div>
      <h1>🍳 Dapur (Realtime)</h1>

      {orders.map(order => (
        <div key={order._id} style={{ border: "1px solid #ccc", margin: 10 }}>
          <h3>Meja {order.tableNumber}</h3>
          <p>Status: {order.status}</p>

          {order.items.map(item => (
            <div key={item._id}>
              {item.name} - {item.status}
              {item.status !== "served" && (
                <button onClick={() => handleItemAction(order._id, item._id)}>
                  Selesai
                </button>
              )}
            </div>
          ))}

          <button onClick={() => handleGlobalAction(order._id, order.status)}>
            NEXT
          </button>
        </div>
      ))}
    </div>
  );
}

export default Kitchen;
