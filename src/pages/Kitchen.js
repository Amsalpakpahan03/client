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

  /* ================= SOCKET ================= */
  useEffect(() => {
    fetchOrders();

    const onNewOrder = (order) => {
      setOrders((prev) => {
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
    }
  };

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

/* ================= STYLES (WAJIB ADA) ================= */

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6f8",
    padding: "24px",
    fontFamily: "Segoe UI, sans-serif",
  },
  header: { marginBottom: "24px" },
  title: { margin: 0, fontSize: "28px" },
  subtitle: { color: "#7f8c8d" },
  empty: {
    background: "#fff",
    padding: "40px",
    textAlign: "center",
    borderRadius: "12px",
    color: "#95a5a6",
    fontSize: "18px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "20px",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  table: { margin: 0, fontSize: "20px" },
  queue: { fontSize: "13px", color: "#7f8c8d" },
  badge: {
    padding: "6px 12px",
    borderRadius: "20px",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "bold",
  },
  time: {
    fontSize: "13px",
    color: "#7f8c8d",
    margin: "10px 0",
  },
  items: { paddingLeft: "18px", marginBottom: "16px" },
  button: {
    border: "none",
    color: "#fff",
    padding: "12px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "bold",
  },
};
