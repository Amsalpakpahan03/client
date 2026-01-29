import React, { useEffect, useState, useCallback } from "react";
import { OrderAPI } from "../api/order.api";
import socket from "../api/socket";

function Kitchen() {
  const [orders, setOrders] = useState([]);

  /* ================= FETCH AWAL ================= */
  const fetchOrders = useCallback(async () => {
    const { data } = await OrderAPI.getAll();
    setOrders(data);
  }, []);

  /* ================= SOCKET LISTENER ================= */
  useEffect(() => {
    fetchOrders();

    const onNewOrder = (order) => {
      setOrders((prev) => {
        // ⛔ cegah duplikat
        if (prev.some((o) => o._id === order._id)) return prev;
        return [...prev, order];
      });
    };

    const onStatusUpdate = (updatedOrder) => {
      setOrders((prev) =>
        prev
          .map((o) =>
            o._id === updatedOrder._id ? updatedOrder : o
          )
          // ❗ optional: hapus yang PAID dari dapur
          .filter((o) => o.status !== "paid")
      );
    };

    socket.on("admin_newOrder", onNewOrder);
    socket.on("admin_orderStatusUpdated", onStatusUpdate);

    return () => {
      socket.off("admin_newOrder", onNewOrder);
      socket.off("admin_orderStatusUpdated", onStatusUpdate);
    };
  }, [fetchOrders]);

  /* ================= UPDATE STATUS ================= */
  const updateStatus = async (id, currentStatus) => {
    const flow = {
      pending: "cooking",
      cooking: "served",
      served: "paid",
    };

    if (flow[currentStatus]) {
      await OrderAPI.updateStatus(id, flow[currentStatus]);
      // ❌ JANGAN fetchOrders()
      // ✅ biarkan socket yang update
    }
  };

  /* ================= UI CONFIG ================= */
  const statusConfig = {
    pending: { label: "PENDING", color: "#e74c3c" },
    cooking: { label: "COOKING", color: "#f39c12" },
    served: { label: "SERVED", color: "#2ecc71" },
    paid: { label: "PAID", color: "#7f8c8d" },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>🍳 Dapur – Antrian Pesanan</h1>
        <span style={styles.subtitle}>
          First Come First Served (FCFS)
        </span>
      </header>

      {orders.length === 0 ? (
        <div style={styles.empty}>Tidak ada antrian</div>
      ) : (
        <div style={styles.grid}>
          {orders.map((order, index) => {
            const status = statusConfig[order.status];

            return (
              <div key={order._id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2 style={styles.table}>
                      Meja {order.tableNumber}
                    </h2>
                    <span style={styles.queue}>
                      Antrian #{index + 1}
                    </span>
                  </div>

                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor: status.color,
                    }}
                  >
                    {status.label}
                  </span>
                </div>

                <div style={styles.time}>
                  Masuk:{" "}
                  {new Date(order.createdAt).toLocaleTimeString()}
                </div>

                <ul style={styles.items}>
                  {order.items.map((item, i) => (
                    <li key={i}>
                      <strong>{item.quantity}x</strong>{" "}
                      {item.name}
                    </li>
                  ))}
                </ul>

                {order.status !== "paid" && (
                  <button
                    style={{
                      ...styles.button,
                      backgroundColor: status.color,
                    }}
                    onClick={() =>
                      updateStatus(order._id, order.status)
                    }
                  >
                    {order.status === "pending" && "Mulai Masak"}
                    {order.status === "cooking" && "Sajikan"}
                    {order.status === "served" && "Selesaikan"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Kitchen;
