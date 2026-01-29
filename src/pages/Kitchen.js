import React, { useEffect, useState, useCallback, useRef } from "react";
import { OrderAPI } from "../api/order.api";
import socket from "../api/socket";

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const ordersRef = useRef([]);

  // Sinkronisasi State & Ref agar Socket selalu dapat data terbaru
  const syncOrders = (data) => {
    setOrders(data);
    ordersRef.current = data;
  };

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await OrderAPI.getAll();
      syncOrders(data);
    } catch (err) {
      console.error("Gagal ambil data:", err);
    }
  }, []);

  /* ================= SOCKET LOGIC (ANTI-REFRESH) ================= */
  useEffect(() => {
    fetchOrders();

    // Pastikan socket terkoneksi
    socket.on("connect", () => console.log("✅ Terhubung ke Server"));

    const onNewOrder = (order) => {
      console.log("📩 Pesanan Baru:", order);
      const isExist = ordersRef.current.find((o) => String(o._id) === String(order._id));
      if (!isExist) {
        syncOrders([...ordersRef.current, order]);
      }
    };

    const onStatusUpdate = (updatedOrder) => {
      console.log("🔄 Update Diterima:", updatedOrder);
      if (updatedOrder.status === "paid") {
        syncOrders(ordersRef.current.filter((o) => String(o._id) !== String(updatedOrder._id)));
      } else {
        syncOrders(ordersRef.current.map((o) => 
          String(o._id) === String(updatedOrder._id) ? updatedOrder : o
        ));
      }
    };

    socket.on("admin_newOrder", onNewOrder);
    socket.on("admin_orderStatusUpdated", onStatusUpdate);

    return () => {
      socket.off("admin_newOrder");
      socket.off("admin_orderStatusUpdated");
    };
  }, [fetchOrders]);

  /* ================= ACTION HANDLERS ================= */

  // TOMBOL TERPISAH: Update status per item (Makanan/Minuman)
  const handleItemAction = async (orderId, itemId) => {
    try {
      // Mengirim request ke backend untuk update status item spesifik
      await OrderAPI.updateItemStatus(orderId, itemId, "served");
      // Tidak perlu setOrders manual di sini, biarkan socket yang mengupdate otomatis
    } catch (err) {
      alert("Gagal update item!");
    }
  };

  // TOMBOL GLOBAL: Update status pesanan (Pending -> Cooking -> Served)
  const handleGlobalAction = async (id, currentStatus) => {
    const nextStatus = { pending: "cooking", cooking: "served", served: "paid" };
    try {
      if (nextStatus[currentStatus]) {
        await OrderAPI.updateStatus(id, nextStatus[currentStatus]);
      }
    } catch (err) {
      alert("Gagal update status global!");
    }
  };

  const statusConfig = {
    pending: { label: "BARU", color: "#e74c3c" },
    cooking: { label: "PROSES", color: "#f39c12" },
    served: { label: "SIAP", color: "#2ecc71" },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>🍳 Dashboard Dapur</h1>
        <div style={styles.status}>● Realtime Connected</div>
      </header>

      <div style={styles.grid}>
        {orders.map((order) => {
          const cfg = statusConfig[order.status] || { label: "UNKNOWN", color: "#95a5a6" };
          const drinks = order.items.filter(i => i.category === "Minuman");
          const foods = order.items.filter(i => i.category !== "Minuman");

          return (
            <div key={order._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={{margin:0}}>Meja {order.tableNumber}</h2>
                <span style={{...styles.badge, backgroundColor: cfg.color}}>{cfg.label}</span>
              </div>

              {/* SEKSI MINUMAN */}
              {drinks.length > 0 && (
                <div style={styles.section}>
                  <p style={{...styles.sectionTitle, color: '#3498db'}}>🥤 MINUMAN</p>
                  {drinks.map(item => (
                    <div key={item._id} style={styles.row}>
                      <span style={{ textDecoration: item.status === 'served' ? 'line-through' : 'none' }}>
                        {item.quantity}x {item.name}
                      </span>
                      {item.status !== 'served' ? (
                        <button style={styles.miniBtn} onClick={() => handleItemAction(order._id, item._id)}>Sajikan</button>
                      ) : <span style={{color: '#2ecc71'}}>✔</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* SEKSI MAKANAN */}
              {foods.length > 0 && (
                <div style={styles.section}>
                  <p style={{...styles.sectionTitle, color: '#e67e22'}}>🍔 MAKANAN</p>
                  {foods.map(item => (
                    <div key={item._id} style={styles.row}>
                      <span style={{ textDecoration: item.status === 'served' ? 'line-through' : 'none' }}>
                        {item.quantity}x {item.name}
                      </span>
                      {item.status !== 'served' ? (
                        <button style={{...styles.miniBtn, backgroundColor: '#e67e22'}} onClick={() => handleItemAction(order._id, item._id)}>Siap</button>
                      ) : <span style={{color: '#2ecc71'}}>✔</span>}
                    </div>
                  ))}
                </div>
              )}

              <button 
                style={{...styles.mainBtn, backgroundColor: cfg.color}}
                onClick={() => handleGlobalAction(order._id, order.status)}
              >
                {order.status === 'pending' ? 'MULAI MASAK' : order.status === 'cooking' ? 'SELESAIKAN MEJA' : 'LUNASKAN'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '20px', background: '#f8f9fa', minHeight: '100vh', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' },
  status: { color: '#2ecc71', fontSize: '12px', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' },
  card: { background: '#fff', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  badge: { color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' },
  section: { background: '#f1f3f5', padding: '10px', borderRadius: '8px', marginBottom: '10px' },
  sectionTitle: { fontSize: '11px', fontWeight: 'bold', margin: '0 0 8px 0' },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px', alignItems: 'center' },
  miniBtn: { border: 'none', color: '#fff', background: '#3498db', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  mainBtn: { width: '100%', border: 'none', color: '#fff', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }
};

export default Kitchen;
