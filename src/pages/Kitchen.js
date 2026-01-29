import React, { useEffect, useState, useCallback, useRef } from "react";
import { OrderAPI } from "../api/order.api";
import socket from "../api/socket";

function Kitchen() {
  const [orders, setOrders] = useState([]);
  // Gunakan ref untuk melacak data terbaru tanpa memicu re-render berlebih
  const ordersRef = useRef([]);

  /* ================= 1. FETCH DATA AWAL ================= */
  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await OrderAPI.getAll();
      setOrders(data);
      ordersRef.current = data;
    } catch (err) {
      console.error("Gagal mengambil data:", err);
    }
  }, []);

  /* ================= 2. HANDLER LOGIC ================= */
  const onNewOrder = useCallback((order) => {
    console.log("📩 Sinyal Pesanan Baru:", order);
    setOrders((prev) => {
      const isExist = prev.find((o) => String(o._id) === String(order._id));
      if (isExist) return prev;
      const newOrders = [...prev, order];
      ordersRef.current = newOrders;
      return newOrders;
    });
  }, []);

  const onStatusUpdate = useCallback((updatedOrder) => {
    console.log("🔄 Sinyal Update Diterima:", updatedOrder);
    setOrders((prev) => {
      if (updatedOrder.status === "paid") {
        const filtered = prev.filter((o) => String(o._id) !== String(updatedOrder._id));
        ordersRef.current = filtered;
        return filtered;
      }
      const mapped = prev.map((o) => 
        String(o._id) === String(updatedOrder._id) ? updatedOrder : o
      );
      ordersRef.current = mapped;
      return mapped;
    });
  }, []);

  /* ================= 3. SOCKET CONNECTION ================= */
  /* ================= SOCKET (PERBAIKAN) ================= */
useEffect(() => {
  fetchOrders();

  const onNewOrder = (order) => {
    console.log("Pesanan baru diterima via socket:", order); // Tambahkan log untuk debug
    setOrders((prev) => {
      // Filter untuk memastikan tidak ada ID yang sama sebelum menambah
      const isExist = prev.find((o) => o._id === order._id);
      if (isExist) return prev; 
      return [...prev, order];
    });
  };

  const onStatusUpdate = (updatedOrder) => {
    setOrders((prev) => {
      // Jika statusnya 'paid', hilangkan dari daftar dapur
      if (updatedOrder.status === "paid") {
        return prev.filter((o) => o._id !== updatedOrder._id);
      }
      // Update data yang ada
      return prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o));
    });
  };

  socket.on("admin_newOrder", onNewOrder);
  socket.on("admin_orderStatusUpdated", onStatusUpdate);

  return () => {
    socket.off("admin_newOrder", onNewOrder);
    socket.off("admin_orderStatusUpdated", onStatusUpdate);
  };
}, [fetchOrders]);

  /* ================= 4. ACTIONS ================= */
  const updateItemStatus = async (orderId, itemId, currentStatus) => {
    try {
      await OrderAPI.updateItemStatus(orderId, itemId, "served");
    } catch (err) {
      console.error("Gagal update item");
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
    pending: { label: "NEW", color: "#e74c3c" },
    cooking: { label: "COOKING", color: "#f39c12" },
    served: { label: "SERVED", color: "#2ecc71" },
    paid: { label: "PAID", color: "#7f8c8d" },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>🍳 Dapur – Antrian Pesanan</h1>
        <div style={styles.indicator}>
           <div style={styles.dot}></div> Realtime Active
        </div>
      </header>

      <div style={styles.grid}>
        {orders.map((order, index) => {
          const status = statusConfig[order.status] || statusConfig.pending;
          const drinks = order.items.filter(i => i.category === "Minuman");
          const foods = order.items.filter(i => i.category !== "Minuman");

          return (
            <div key={order._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <b>Meja {order.tableNumber}</b>
                <span style={{...styles.badge, backgroundColor: status.color}}>{status.label}</span>
              </div>

              {drinks.length > 0 && (
                <div style={styles.section}>
                  <p style={styles.sectionTitle}>🥤 MINUMAN</p>
                  {drinks.map(item => (
                    <div key={item._id} style={styles.itemRow}>
                      <span style={{textDecoration: item.status === 'served' ? 'line-through' : 'none'}}>
                        {item.quantity}x {item.name}
                      </span>
                      {item.status !== 'served' && (
                        <button style={styles.btnSmall} onClick={() => updateItemStatus(order._id, item._id)}>Sajikan</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {foods.length > 0 && (
                <div style={styles.section}>
                  <p style={styles.sectionTitle}>🍔 MAKANAN</p>
                  {foods.map(item => (
                    <div key={item._id} style={styles.itemRow}>
                      <span style={{textDecoration: item.status === 'served' ? 'line-through' : 'none'}}>
                        {item.quantity}x {item.name}
                      </span>
                      {item.status !== 'served' && (
                        <button style={{...styles.btnSmall, background: '#e67e22'}} onClick={() => updateItemStatus(order._id, item._id)}>Siap</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button 
                style={{...styles.btnMain, backgroundColor: status.color}}
                onClick={() => updateStatus(order._id, order.status)}
              >
                {order.status === "pending" ? "Masak" : order.status === "cooking" ? "Sajikan Semua" : "Selesai"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: "20px", background: "#f5f5f5", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", marginBottom: "20px" },
  indicator: { fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" },
  dot: { width: "8px", height: "8px", background: "#2ecc71", borderRadius: "50%" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" },
  card: { background: "#fff", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" },
  cardHeader: { display: "flex", justifyContent: "space-between", marginBottom: "15px" },
  badge: { color: "#fff", padding: "3px 8px", borderRadius: "5px", fontSize: "10px" },
  section: { background: "#f9f9f9", padding: "10px", borderRadius: "5px", marginBottom: "10px" },
  sectionTitle: { fontSize: "10px", color: "#999", margin: "0 0 5px 0" },
  itemRow: { display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "5px" },
  btnSmall: { border: "none", background: "#3498db", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", cursor: "pointer" },
  btnMain: { width: "100%", border: "none", color: "#fff", padding: "10px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", marginTop: "10px" }
};

export default Kitchen;
