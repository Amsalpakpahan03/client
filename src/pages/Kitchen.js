import React, { useEffect, useState, useCallback, useRef } from "react";
import { OrderAPI } from "../api/order.api";
import socket from "../api/socket";

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const ordersRef = useRef([]);

  // Fungsi untuk mengupdate state dan ref secara bersamaan
  const syncOrders = (newData) => {
    setOrders(newData);
    ordersRef.current = newData;
  };

  /* ================= 1. FETCH DATA AWAL ================= */
  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await OrderAPI.getAll();
      syncOrders(data);
    } catch (err) {
      console.error("Gagal mengambil data:", err);
    }
  }, []);

  /* ================= 2. REALTIME SOCKET LOGIC ================= */
  useEffect(() => {
    fetchOrders();

    // Handler untuk pesanan baru
    const onNewOrder = (order) => {
      console.log("📩 Socket: Pesanan Baru", order);
      const isExist = ordersRef.current.find((o) => String(o._id) === String(order._id));
      if (!isExist) {
        syncOrders([...ordersRef.current, order]);
      }
    };

    // Handler untuk update status (global maupun per-item)
    const onStatusUpdate = (updatedOrder) => {
      console.log("🔄 Socket: Update Diterima", updatedOrder);
      if (updatedOrder.status === "paid") {
        // Jika lunas, hapus dari antrian dapur
        const filtered = ordersRef.current.filter((o) => String(o._id) !== String(updatedOrder._id));
        syncOrders(filtered);
      } else {
        // Update data pesanan yang ada di list
        const mapped = ordersRef.current.map((o) =>
          String(o._id) === String(updatedOrder._id) ? updatedOrder : o
        );
        syncOrders(mapped);
      }
    };

    socket.on("admin_newOrder", onNewOrder);
    socket.on("admin_orderStatusUpdated", onStatusUpdate);

    // Cleanup saat pindah halaman
    return () => {
      socket.off("admin_newOrder", onNewOrder);
      socket.off("admin_orderStatusUpdated", onStatusUpdate);
    };
  }, [fetchOrders]);

  /* ================= 3. ACTIONS ================= */
  const updateItemStatus = async (orderId, itemId) => {
    try {
      // Mengubah status item spesifik menjadi 'served'
      await OrderAPI.updateItemStatus(orderId, itemId, "served");
    } catch (err) {
      console.error("Gagal update item status");
    }
  };

  const updateStatus = async (id, currentStatus) => {
    const flow = { pending: "cooking", cooking: "served", served: "paid" };
    if (flow[currentStatus]) {
      try {
        await OrderAPI.updateStatus(id, flow[currentStatus]);
      } catch (err) {
        console.error("Gagal update status global");
      }
    }
  };

  const statusConfig = {
    pending: { label: "BARU", color: "#e74c3c" },
    cooking: { label: "PROSES", color: "#f39c12" },
    served: { label: "SELESAI", color: "#2ecc71" },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>🍳 Dapur – Antrian Pesanan</h1>
        <div style={styles.indicator}>
          <div style={styles.dot}></div>
          <span style={{color: '#2ecc71', fontWeight: 'bold'}}>Sistem Terhubung</span>
        </div>
      </header>

      <div style={styles.grid}>
        {orders.map((order, index) => {
          const status = statusConfig[order.status] || { label: order.status, color: "#7f8c8d" };
          
          // Pemisahan kategori (Minuman vs Makanan/Lainnya)
          const drinks = order.items.filter((i) => i.category === "Minuman");
          const foods = order.items.filter((i) => i.category !== "Minuman");

          return (
            <div key={order._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>Meja {order.tableNumber}</h2>
                  <small style={{ color: '#888' }}>#{index + 1} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
                <span style={{ ...styles.badge, backgroundColor: status.color }}>
                  {status.label}
                </span>
              </div>

              {/* AREA MINUMAN */}
              {drinks.length > 0 && (
                <div style={{ ...styles.section, borderLeft: '4px solid #3498db' }}>
                  <p style={styles.sectionTitle}>🥤 MINUMAN</p>
                  {drinks.map((item) => (
                    <div key={item._id} style={styles.itemRow}>
                      <span style={{ 
                        textDecoration: item.status === "served" ? "line-through" : "none",
                        color: item.status === "served" ? "#bbb" : "#333"
                      }}>
                        <strong>{item.quantity}x</strong> {item.name}
                      </span>
                      {item.status !== "served" && (
                        <button style={styles.btnSmall} onClick={() => updateItemStatus(order._id, item._id)}>Antar</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* AREA MAKANAN */}
              {foods.length > 0 && (
                <div style={{ ...styles.section, borderLeft: '4px solid #e67e22' }}>
                  <p style={{ ...styles.sectionTitle, color: '#e67e22' }}>🍔 MAKANAN & LAINNYA</p>
                  {foods.map((item) => (
                    <div key={item._id} style={styles.itemRow}>
                      <span style={{ 
                        textDecoration: item.status === "served" ? "line-through" : "none",
                        color: item.status === "served" ? "#bbb" : "#333"
                      }}>
                        <strong>{item.quantity}x</strong> {item.name}
                      </span>
                      {item.status !== "served" && (
                        <button style={{ ...styles.btnSmall, background: "#e67e22" }} onClick={() => updateItemStatus(order._id, item._id)}>Siap</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                style={{ ...styles.btnMain, backgroundColor: status.color }}
                onClick={() => updateStatus(order._id, order.status)}
              >
                {order.status === "pending" ? "Mulai Masak" : order.status === "cooking" ? "Sajikan Semua" : "Selesaikan & Bayar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: "25px", background: "#f0f2f5", minHeight: "100vh", fontFamily: "'Inter', sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" },
  title: { margin: 0, fontSize: "26px", fontWeight: "800", color: "#2c3e50" },
  indicator: { fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", padding: "5px 12px", borderRadius: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" },
  dot: { width: "10px", height: "10px", background: "#2ecc71", borderRadius: "50%", animation: "pulse 2s infinite" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "25px" },
  card: { background: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", display: 'flex', flexDirection: 'column' },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  badge: { color: "#fff", padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold" },
  section: { background: "#f8f9fa", padding: "12px", borderRadius: "10px", marginBottom: "12px" },
  sectionTitle: { fontSize: "11px", fontWeight: "800", color: "#3498db", margin: "0 0 8px 0", letterSpacing: "0.5px" },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "15px", marginBottom: "8px" },
  btnSmall: { border: "none", background: "#3498db", color: "#fff", padding: "5px 12px", borderRadius: "6px", fontSize: "11px", cursor: "pointer", fontWeight: "bold" },
  btnMain: { width: "100%", border: "none", color: "#fff", padding: "14px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold", marginTop: "auto", transition: "all 0.3s ease" }
};

export default Kitchen;
