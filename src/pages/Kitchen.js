import React, { useEffect, useState, useCallback, useRef } from "react";
import { OrderAPI } from "../api/order.api";
import socket from "../api/socket";

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const ordersRef = useRef([]);

  // Fungsi sinkronisasi agar ref selalu memegang data terbaru untuk socket
  const syncOrders = (data) => {
    setOrders(data);
    ordersRef.current = data;
  };

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await OrderAPI.getAll();
      syncOrders(data);
    } catch (err) {
      console.error("Gagal ambil data awal:", err);
    }
  }, []);

  /* ================= SOCKET LOGIC (ANTI-REFRESH) ================= */
  useEffect(() => {
    fetchOrders();

    // Handler Pesanan Baru
    const onNewOrder = (order) => {
      console.log("📩 Pesanan Baru Masuk:", order);
      // Gunakan ordersRef.current untuk pengecekan agar data tidak stale
      const isExist = ordersRef.current.find((o) => String(o._id) === String(order._id));
      if (!isExist) {
        syncOrders([...ordersRef.current, order]);
      }
    };

    // Handler Update Status (Global maupun Per Item)
    const onStatusUpdate = (updatedOrder) => {
      console.log("🔄 Update Status Diterima:", updatedOrder);
      if (updatedOrder.status === "paid") {
        // Hapus jika sudah lunas
        const filtered = ordersRef.current.filter((o) => String(o._id) !== String(updatedOrder._id));
        syncOrders(filtered);
      } else {
        // Update data spesifik di dalam array
        const mapped = ordersRef.current.map((o) => 
          String(o._id) === String(updatedOrder._id) ? updatedOrder : o
        );
        syncOrders(mapped);
      }
    };

    // Pasang Listener
    socket.on("admin_newOrder", onNewOrder);
    socket.on("orderStatusUpdated", onStatusUpdate);

    // CLEANUP: Sangat penting agar tidak perlu refresh
    return () => {
      socket.off("admin_newOrder", onNewOrder);
      socket.off("orderStatusUpdated", onStatusUpdate);
    };
  }, [fetchOrders]);

  /* ================= ACTION HANDLERS ================= */

  // TOMBOL TERPISAH: Update status per item (Makanan/Minuman)
  const handleItemAction = async (orderId, itemId) => {
    try {
      // Mengirim request ke backend untuk tandai item tertentu sebagai 'served'
      await OrderAPI.updateItemStatus(orderId, itemId, "served");
      // UI akan terupdate otomatis via socket.on("orderStatusUpdated")
    } catch (err) {
      alert("Gagal memperbarui item!");
    }
  };

  // TOMBOL GLOBAL: Update status satu meja (Pending -> Cooking -> Served)
  const handleGlobalAction = async (id, currentStatus) => {
    const nextStatus = { pending: "cooking", cooking: "served", served: "paid" };
    try {
      if (nextStatus[currentStatus]) {
        await OrderAPI.updateStatus(id, nextStatus[currentStatus]);
      }
    } catch (err) {
      alert("Gagal memperbarui status meja!");
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
        <div style={styles.liveBadge}>● Realtime Active</div>
      </header>

      <div style={styles.grid}>
        {orders.map((order, idx) => {
          const cfg = statusConfig[order.status] || { label: "PAID", color: "#95a5a6" };
          
          // Pisahkan item berdasarkan kategori untuk tombol terpisah
          const drinks = order.items.filter(i => i.category === "Minuman");
          const foods = order.items.filter(i => i.category !== "Minuman");

          return (
            <div key={order._id} style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={{margin:0, fontSize: '20px'}}>Meja {order.tableNumber}</h2>
                <span style={{...styles.badge, backgroundColor: cfg.color}}>{cfg.label}</span>
              </div>
              <small style={{color: '#888'}}>Antrian #{idx + 1}</small>

              {/* SECTION KHUSUS MINUMAN */}
              {drinks.length > 0 && (
                <div style={{...styles.section, borderLeft: '4px solid #3498db'}}>
                  <p style={{...styles.sectionTitle, color: '#3498db'}}>🥤 MINUMAN</p>
                  {drinks.map(item => (
                    <div key={item._id} style={styles.row}>
                      <span style={{ 
                        textDecoration: item.status === 'served' ? 'line-through' : 'none',
                        color: item.status === 'served' ? '#adb5bd' : '#333'
                      }}>
                        {item.quantity}x {item.name}
                      </span>
                      {item.status !== 'served' ? (
                        <button style={styles.miniBtn} onClick={() => handleItemAction(order._id, item._id)}>Antar</button>
                      ) : <span style={{color: '#2ecc71', fontWeight: 'bold'}}>✔</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* SECTION KHUSUS MAKANAN */}
              {foods.length > 0 && (
                <div style={{...styles.section, borderLeft: '4px solid #e67e22'}}>
                  <p style={{...styles.sectionTitle, color: '#e67e22'}}>🍔 MAKANAN</p>
                  {foods.map(item => (
                    <div key={item._id} style={styles.row}>
                      <span style={{ 
                        textDecoration: item.status === 'served' ? 'line-through' : 'none',
                        color: item.status === 'served' ? '#adb5bd' : '#333'
                      }}>
                        {item.quantity}x {item.name}
                      </span>
                      {item.status !== 'served' ? (
                        <button style={{...styles.miniBtn, backgroundColor: '#e67e22'}} onClick={() => handleItemAction(order._id, item._id)}>Selesai</button>
                      ) : <span style={{color: '#2ecc71', fontWeight: 'bold'}}>✔</span>}
                    </div>
                  ))}
                </div>
              )}

              <div style={{marginTop: 'auto'}}>
                <button 
                  style={{...styles.mainBtn, backgroundColor: cfg.color}}
                  onClick={() => handleGlobalAction(order._id, order.status)}
                >
                  {order.status === 'pending' ? 'MULAI MASAK' : order.status === 'cooking' ? 'SAJIKAN MEJA' : 'LUNASKAN'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '25px', background: '#f1f3f5', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid #dee2e6', paddingBottom: '10px' },
  title: { margin: 0, color: '#212529', fontWeight: '800' },
  liveBadge: { color: '#2ecc71', fontSize: '12px', fontWeight: 'bold', background: '#e9f7ef', padding: '5px 12px', borderRadius: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' },
  card: { background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' },
  badge: { color: '#fff', padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' },
  section: { background: '#f8f9fa', padding: '12px', borderRadius: '10px', marginTop: '15px' },
  sectionTitle: { fontSize: '10px', fontWeight: '900', margin: '0 0 10px 0', letterSpacing: '1px' },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: '15px', marginBottom: '8px', alignItems: 'center' },
  miniBtn: { border: 'none', color: '#fff', background: '#3498db', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', transition: '0.2s' },
  mainBtn: { width: '100%', border: 'none', color: '#fff', padding: '14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px', fontSize: '14px', transition: '0.3s' }
};

export default Kitchen;
