import React, { useEffect, useState, useCallback } from "react";
import { OrderAPI } from "../api/order.api";
import socket from "../api/socket";

function Kitchen() {
  const [orders, setOrders] = useState([]);

  const fetchOrders = useCallback(async () => {
    const { data } = await OrderAPI.getAll();
    setOrders(data);
  }, []);

  /* ================= SOCKET LOGIC DI KITCHEN.JS ================= */
useEffect(() => {
  fetchOrders();

  const onNewOrder = (order) => {
    console.log("📩 Pesanan Baru Masuk:", order);
    setOrders((prev) => {
      // Pastikan tidak ada duplikasi ID
      const isExist = prev.find((o) => String(o._id) === String(order._id));
      if (isExist) return prev;
      
      // Gunakan spread operator agar React mendeteksi perubahan state
      return [...prev, order];
    });
  };

  const onStatusUpdate = (updatedOrder) => {
    setOrders((prev) => {
      if (updatedOrder.status === "paid") {
        return prev.filter((o) => String(o._id) !== String(updatedOrder._id));
      }
      return prev.map((o) => 
        String(o._id) === String(updatedOrder._id) ? updatedOrder : o
      );
    });
  };

  socket.on("admin_newOrder", onNewOrder);
  socket.on("admin_orderStatusUpdated", onStatusUpdate);

  return () => {
    socket.off("admin_newOrder", onNewOrder);
    socket.off("admin_orderStatusUpdated", onStatusUpdate);
  };
}, [fetchOrders]);
  // Handler baru untuk update status per item (misal: hanya minuman)
  const updateItemStatus = async (orderId, itemId, currentStatus) => {
    // Logika flow sederhana untuk item: pending -> served
    const nextStatus = currentStatus === "pending" ? "served" : "served";
    try {
      // Pastikan API/Backend mendukung updateItemStatus
      await OrderAPI.updateItemStatus(orderId, itemId, nextStatus);
    } catch (err) {
      console.error("Gagal update item status", err);
    }
  };

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
        <span style={styles.subtitle}>Sistem Pemisahan Makanan & Minuman</span>
      </header>

      {orders.length === 0 ? (
        <div style={styles.empty}>Tidak ada antrian</div>
      ) : (
        <div style={styles.grid}>
          {orders.map((order, index) => {
            const status = statusConfig[order.status];

            // Filter item berdasarkan kategori
            const drinks = order.items.filter(i => i.category === "Minuman");
            const foods = order.items.filter(i => i.category !== "Minuman");

            return (
              <div key={order._id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2 style={styles.table}>Meja {order.tableNumber}</h2>
                    <span style={styles.queue}>Antrian #{index + 1}</span>
                  </div>
                  <span style={{ ...styles.badge, backgroundColor: status.color }}>
                    {status.label}
                  </span>
                </div>

                {/* SECTION MINUMAN */}
                {drinks.length > 0 && (
                  <div style={styles.itemSection}>
                    <h4 style={styles.sectionTitle}>🥤 Minuman</h4>
                    <ul style={styles.itemList}>
                      {drinks.map((item) => (
                        <li key={item._id} style={styles.itemRow}>
                          <span style={{ textDecoration: item.status === 'served' ? 'line-through' : 'none' }}>
                            <strong>{item.quantity}x</strong> {item.name}
                          </span>
                          {item.status !== 'served' ? (
                            <button 
                              style={styles.itemBtn} 
                              onClick={() => updateItemStatus(order._id, item._id, item.status)}
                            >
                              Sajikan
                            </button>
                          ) : <span style={{color: '#2ecc71'}}>✅</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* SECTION MAKANAN */}
                {foods.length > 0 && (
                  <div style={styles.itemSection}>
                    <h4 style={styles.sectionTitle}>🍔 Makanan / Lainnya</h4>
                    <ul style={styles.itemList}>
                      {foods.map((item) => (
                        <li key={item._id} style={styles.itemRow}>
                          <span style={{ textDecoration: item.status === 'served' ? 'line-through' : 'none' }}>
                            <strong>{item.quantity}x</strong> {item.name}
                          </span>
                          {item.status !== 'served' ? (
                            <button 
                              style={styles.itemBtnFood} 
                              onClick={() => updateItemStatus(order._id, item._id, item.status)}
                            >
                              Siap
                            </button>
                          ) : <span style={{color: '#2ecc71'}}>✅</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ borderTop: '1px solid #eee', marginTop: '10px', paddingTop: '10px' }}>
                  <button
                    style={{ ...styles.button, backgroundColor: status.color }}
                    onClick={() => updateStatus(order._id, order.status)}
                  >
                    Set Global: {order.status === "pending" ? "Mulai Masak" : order.status === "cooking" ? "Semua Disajikan" : "Selesaikan"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  /* ... styles sebelumnya ... */
  page: { minHeight: "100vh", background: "#f4f6f8", padding: "24px", fontFamily: "Segoe UI, sans-serif" },
  header: { marginBottom: "24px" },
  title: { margin: 0, fontSize: "28px" },
  subtitle: { color: "#7f8c8d" },
  empty: { background: "#fff", padding: "40px", textAlign: "center", borderRadius: "12px", color: "#95a5a6", fontSize: "18px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" },
  card: { background: "#fff", borderRadius: "16px", padding: "16px", boxShadow: "0 8px 20px rgba(0,0,0,0.08)", display: 'flex', flexDirection: 'column' },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: '10px' },
  table: { margin: 0, fontSize: "20px" },
  queue: { fontSize: "13px", color: "#7f8c8d" },
  badge: { padding: "6px 12px", borderRadius: "20px", color: "#fff", fontSize: "12px", fontWeight: "bold" },
  
  // Styles baru untuk per item
  itemSection: { marginTop: '10px', padding: '8px', background: '#f9f9f9', borderRadius: '8px' },
  sectionTitle: { margin: '0 0 5px 0', fontSize: '14px', color: '#666', borderBottom: '1px solid #ddd' },
  itemList: { listStyle: 'none', padding: 0, margin: 0 },
  itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', fontSize: '14px' },
  itemBtn: { padding: '2px 8px', fontSize: '11px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  itemBtnFood: { padding: '2px 8px', fontSize: '11px', background: '#e67e22', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  
  button: { border: "none", color: "#fff", padding: "10px", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", width: '100%' },
};

export default Kitchen;
