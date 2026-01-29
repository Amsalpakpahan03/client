import React, { useEffect, useState, useCallback } from "react";
import { OrderAPI } from "../api/order.api";
import socket from "../api/socket";

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= 1. FETCH DATA AWAL ================= */
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await OrderAPI.getAll();
      // Urutkan berdasarkan waktu (FCFS)
      setOrders(data);
    } catch (err) {
      console.error("Gagal mengambil data pesanan:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ================= 2. REAL-TIME LOGIC (SOCKET) ================= */
  useEffect(() => {
    fetchOrders();

    // Handler Pesanan Baru
    const onNewOrder = (order) => {
      console.log("📩 Socket: Pesanan Baru Masuk", order);
      setOrders((prev) => {
        const isExist = prev.find((o) => String(o._id) === String(order._id));
        if (isExist) return prev;
        return [...prev, order]; // Tambah ke antrian
      });
    };

    // Handler Update Status (Global & Per Item)
    const onStatusUpdate = (updatedOrder) => {
      console.log("🔄 Socket: Update Diterima", updatedOrder);
      setOrders((prev) => {
        // Jika status lunas (paid), hapus dari layar dapur
        if (updatedOrder.status === "paid") {
          return prev.filter((o) => String(o._id) !== String(updatedOrder._id));
        }
        // Update data pesanan yang cocok
        return prev.map((o) => 
          String(o._id) === String(updatedOrder._id) ? updatedOrder : o
        );
      });
    };

    socket.on("admin_newOrder", onNewOrder);
    socket.on("orderStatusUpdated", onStatusUpdate);

    return () => {
      socket.off("admin_newOrder");
      socket.off("orderStatusUpdated");
    };
  }, [fetchOrders]);

  /* ================= 3. ACTIONS (UPDATE STATUS) ================= */
  
  // Update status per item (Misal: Sajikan Es Teh saja)
  const updateItemStatus = async (orderId, itemId, currentStatus) => {
    try {
      // Flow: pending -> served
      const nextStatus = "served";
      await OrderAPI.updateItemStatus(orderId, itemId, nextStatus);
    } catch (err) {
      alert("Gagal update status item");
    }
  };

  // Update status pesanan secara global (Pending -> Cooking -> Served)
  const updateStatus = async (id, currentStatus) => {
    const flow = {
      pending: "cooking",
      cooking: "served",
      served: "paid",
    };
    if (flow[currentStatus]) {
      try {
        await OrderAPI.updateStatus(id, flow[currentStatus]);
      } catch (err) {
        alert("Gagal update status pesanan");
      }
    }
  };

  /* ================= 4. RENDER LOGIC ================= */
  
  const statusConfig = {
    pending: { label: "NEW", color: "#e74c3c" },
    cooking: { label: "COOKING", color: "#f39c12" },
    served: { label: "SERVED", color: "#2ecc71" },
    paid: { label: "PAID", color: "#7f8c8d" },
  };

  if (loading && orders.length === 0) {
    return <div style={styles.empty}>Memuat antrian...</div>;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>🍳 Dapur – Antrian Pesanan</h1>
        <div style={styles.liveIndicator}>
          <span style={styles.pulse}></span> Live System
        </div>
      </header>

      {orders.length === 0 ? (
        <div style={styles.empty}>Tidak ada antrian saat ini</div>
      ) : (
        <div style={styles.grid}>
          {orders.map((order, index) => {
            const status = statusConfig[order.status] || statusConfig.pending;

            // Pemisahan kategori (Case Sensitive sesuai database)
            const drinks = order.items.filter(i => i.category === "Minuman");
            const foods = order.items.filter(i => i.category !== "Minuman");

            return (
              <div key={order._id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h2 style={styles.table}>Meja {order.tableNumber}</h2>
                    <span style={styles.queue}>#{index + 1} • {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <span style={{ ...styles.badge, backgroundColor: status.color }}>
                    {status.label}
                  </span>
                </div>

                {/* AREA MINUMAN */}
                {drinks.length > 0 && (
                  <div style={styles.itemSection}>
                    <h4 style={styles.sectionTitle}>🥤 MINUMAN</h4>
                    {drinks.map((item) => (
                      <div key={item._id} style={styles.itemRow}>
                        <span style={{ 
                          textDecoration: item.status === 'served' ? 'line-through' : 'none',
                          color: item.status === 'served' ? '#aaa' : '#000'
                        }}>
                          <strong>{item.quantity}x</strong> {item.name}
                        </span>
                        {item.status !== 'served' ? (
                          <button style={styles.itemBtn} onClick={() => updateItemStatus(order._id, item._id, item.status)}>Sajikan</button>
                        ) : <span style={styles.check}>✅</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* AREA MAKANAN */}
                {foods.length > 0 && (
                  <div style={{ ...styles.itemSection, borderLeft: '4px solid #e67e22' }}>
                    <h4 style={styles.sectionTitle}>🍔 MAKANAN</h4>
                    {foods.map((item) => (
                      <div key={item._id} style={styles.itemRow}>
                        <span style={{ 
                          textDecoration: item.status === 'served' ? 'line-through' : 'none',
                          color: item.status === 'served' ? '#aaa' : '#000'
                        }}>
                          <strong>{item.quantity}x</strong> {item.name}
                        </span>
                        {item.status !== 'served' ? (
                          <button style={{...styles.itemBtn, backgroundColor: '#e67e22'}} onClick={() => updateItemStatus(order._id, item._id, item.status)}>Siap</button>
                        ) : <span style={styles.check}>✅</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* TOMBOL STATUS GLOBAL */}
                <div style={styles.footer}>
                  <button
                    style={{ ...styles.mainButton, backgroundColor: status.color }}
                    onClick={() => updateStatus(order._id, order.status)}
                  >
                    {order.status === "pending" && "TERIMA & MASAK"}
                    {order.status === "cooking" && "SEMUA DISAJIKAN"}
                    {order.status === "served" && "SELESAI / LUNAS"}
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

/* ================= 5. STYLES ================= */
const styles = {
  page: { minHeight: "100vh", background: "#f0f2f5", padding: "20px", fontFamily: "'Segoe UI', Roboto, sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "20px" },
  title: { margin: 0, fontSize: "24px", color: "#1a1a1a" },
  liveIndicator: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#666', fontWeight: 'bold' },
  pulse: { width: '8px', height: '8px', background: '#2ecc71', borderRadius: '50%', boxShadow: '0 0 0 rgba(46, 204, 113, 0.4)' },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" },
  card: { background: "#fff", borderRadius: "12px", padding: "16px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", border: '1px solid #eee' },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: '15px' },
  table: { margin: 0, fontSize: "22px", fontWeight: '800' },
  queue: { fontSize: "12px", color: "#888" },
  badge: { padding: "4px 10px", borderRadius: "6px", color: "#fff", fontSize: "11px", fontWeight: "bold" },
  itemSection: { marginBottom: '12px', padding: '10px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #3498db' },
  sectionTitle: { margin: '0 0 8px 0', fontSize: '11px', color: '#999', letterSpacing: '1px' },
  itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '15px' },
  itemBtn: { padding: '4px 8px', fontSize: '11px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  check: { fontSize: '14px' },
  footer: { marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px' },
  mainButton: { width: '100%', border: "none", color: "#fff", padding: "12px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "bold", transition: '0.2s' },
  empty: { textAlign: "center", padding: "100px", color: "#999", fontSize: "18px" },
};

export default Kitchen;
