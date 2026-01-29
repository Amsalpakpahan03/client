import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import socket from "../api/socket";
import { useMenu } from "../hooks/useMenu";
import { useOrder } from "../hooks/useOrder";

const CATEGORIES = ["Paket", "Makanan", "Minuman", "Cemilan"];

function OrderMenu() {
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tableNumber = query.get("table");

  const { menuItems = [] } = useMenu();
  const { activeOrder, createOrder, updateOrderFromSocket } = useOrder(tableNumber);

  const [orderToken, setOrderToken] = useState(null);
  const [cart, setCart] = useState({});
  const [isOrdering, setIsOrdering] = useState(false);

  /* ================= 1. SINYAL REAL-TIME (SOCKET) ================= */
  useEffect(() => {
    if (!tableNumber) return;

    // Bergabung ke ruangan meja agar menerima update status khusus meja ini
    socket.emit("joinTable", tableNumber);

    const onUpdateStatus = (updatedOrder) => {
      console.log("📡 Update Status Diterima:", updatedOrder);
      // Pastikan data yang diterima adalah milik meja ini
      if (String(updatedOrder.tableNumber) === String(tableNumber)) {
        updateOrderFromSocket(updatedOrder);
      }
    };

    // Nama event harus sama dengan yang ada di Backend Controller
    socket.on("orderStatusUpdated", onUpdateStatus);

    return () => {
      socket.off("orderStatusUpdated", onUpdateStatus);
      socket.emit("leaveTable", tableNumber);
    };
  }, [tableNumber, updateOrderFromSocket]);

  /* ================= 2. PROSES PESAN (CREATE ORDER) ================= */
  const handleOrder = async () => {
    if (!tableNumber || !orderToken) return alert("QR Code tidak valid!");
    if (!Object.keys(cart).length) return alert("Keranjang kosong!");

    try {
      setIsOrdering(true);
      const items = menuItems
        .filter((m) => cart[m._id])
        .map((m) => ({
          name: m.name,
          quantity: cart[m._id],
          price: m.price,
          category: m.category || "Makanan", // Kirim kategori agar dapur bisa memisahkan
        }));

      // Mengirim ke Backend via Hook useOrder
      await createOrder({
        tableNumber,
        items,
        totalPrice: menuItems.reduce((sum, item) => sum + (cart[item._id] || 0) * (item.price || 0), 0),
      });

      setCart({}); // Reset keranjang jika berhasil
    } catch (err) {
      console.error("Gagal Pesan:", err);
      alert("Gagal mengirim pesanan. Pastikan server aktif.");
    } finally {
      setIsOrdering(false);
    }
  };

  /* ================= 3. RENDER TAMPILAN STATUS ================= */
  if (activeOrder) {
    return (
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <h2>Meja {tableNumber}</h2>
          <p>Status: <strong style={{color: '#e67e22'}}>{activeOrder.status.toUpperCase()}</strong></p>
        </div>

        <div style={styles.statusBox}>
          {activeOrder.items.map((item, i) => (
            <div key={i} style={styles.orderItem}>
              <span>{item.name} x {item.quantity}</span>
              <span style={{ color: item.status === 'served' ? '#2ecc71' : '#f39c12' }}>
                {item.status === 'served' ? "✅ Siap" : "⏳ Dimasak"}
              </span>
            </div>
          ))}
          <div style={styles.totalRow}>
            <strong>Total: Rp {activeOrder.totalPrice.toLocaleString()}</strong>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan Menu Utama (Sama seperti sebelumnya)
  return (
    <div style={styles.container}>
      <h2>Meja {tableNumber}</h2>
      {/* Map Menu Items... */}
      <button onClick={handleOrder} disabled={isOrdering} style={styles.checkoutBtn}>
        {isOrdering ? "Memproses..." : "KONFIRMASI PESANAN"}
      </button>
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' },
  headerCard: { textAlign: 'center', marginBottom: '20px', padding: '15px', background: '#fff', borderRadius: '10px' },
  statusBox: { background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
  orderItem: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' },
  totalRow: { marginTop: '15px', textAlign: 'right', fontSize: '18px', borderTop: '2px dashed #eee', paddingTop: '10px' },
  checkoutBtn: { width: '100%', padding: '15px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' }
};

export default OrderMenu;
