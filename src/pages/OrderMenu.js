import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import socket from "../api/socket";
import { useMenu } from "../hooks/useMenu";
import { useOrder } from "../hooks/useOrder";

/* ================= CONSTANT ================= */
const CATEGORIES = ["Paket", "Makanan", "Minuman", "Cemilan"];

function OrderMenu() {
  const hasInitSocket = useRef(false);
  const heartbeatRef = useRef(null);

  /* ================= URL PARAM ================= */
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tableNumber = query.get("table");

  /* ================= HOOKS ================= */
  const { menuItems = [] } = useMenu();
  const { activeOrder, createOrder, updateOrderFromSocket } = useOrder(tableNumber);

  /* ================= STATE ================= */
  const [orderToken, setOrderToken] = useState(null);
  const [cart, setCart] = useState({});
  const [isLocked, setIsLocked] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  /* ================= CLIENT ID & TOKEN ================= */
  const clientId = useMemo(() => {
    let id = localStorage.getItem("order_client_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("order_client_id", id);
    }
    return id;
  }, []);

  useEffect(() => {
    const tokenFromUrl = query.get("token");
    if (tokenFromUrl) {
      localStorage.setItem("order_token", tokenFromUrl);
      setOrderToken(tokenFromUrl);
    } else {
      setOrderToken(localStorage.getItem("order_token"));
    }
  }, [query]);

  /* ================= SOCKET LOCK & UPDATES ================= */
  useEffect(() => {
    if (!tableNumber) return;

    // Join room khusus meja
    socket.emit("joinTable", tableNumber);
    socket.emit("tryAccessTable", { tableId: tableNumber, clientId });

    const denyHandler = (data) => {
      setIsLocked(true);
      alert(data.message);
    };

    const updateHandler = (updatedOrder) => {
      // Pastikan data yang diterima sesuai dengan meja saat ini
      if (String(updatedOrder.tableNumber) === String(tableNumber)) {
        updateOrderFromSocket(updatedOrder);
      }
    };

    socket.on("accessDenied", denyHandler);
    socket.on("orderStatusUpdated", updateHandler);

    heartbeatRef.current = setInterval(() => {
      socket.emit("heartbeat", { tableId: tableNumber, clientId });
    }, 5000);

    return () => {
      clearInterval(heartbeatRef.current);
      socket.off("accessDenied", denyHandler);
      socket.off("orderStatusUpdated", updateHandler);
      socket.emit("leaveTable", tableNumber);
    };
  }, [tableNumber, clientId, updateOrderFromSocket]);

  /* ================= ACTIONS ================= */
  const addToCart = useCallback((item) => {
    setCart((prev) => ({ ...prev, [item._id]: (prev[item._id] || 0) + 1 }));
  }, []);

  const removeFromCart = useCallback((item) => {
    setCart((prev) => {
      const qty = prev[item._id] || 0;
      if (qty <= 1) {
        const copy = { ...prev };
        delete copy[item._id];
        return copy;
      }
      return { ...prev, [item._id]: qty - 1 };
    });
  }, []);

  const totalPrice = useMemo(() => {
    return menuItems.reduce((sum, item) => sum + (cart[item._id] || 0) * (item.price || 0), 0);
  }, [cart, menuItems]);

  const handleOrder = async () => {
    if (isLocked) return alert("Meja masih terkunci oleh pengguna lain");
    if (!tableNumber) return alert("Meja tidak terdeteksi");
    if (!orderToken) return alert("Akses tidak valid, silakan scan ulang");
    if (!Object.keys(cart).length) return alert("Keranjang masih kosong");

    try {
      setIsOrdering(true);
      const items = menuItems
        .filter((m) => cart[m._id])
        .map((m) => ({
          name: m.name,
          quantity: cart[m._id],
          price: m.price,
          category: m.category || "Makanan", // Sertakan kategori untuk pemisahan di dapur
        }));

      await createOrder({ tableNumber, items, totalPrice });
      setCart({});
    } catch (err) {
      alert("Gagal mengirim pesanan. Pastikan server aktif.");
    } finally {
      setIsOrdering(false);
    }
  };

  /* ================= VIEW RENDERING ================= */
  const menuByCategory = useMemo(() => {
    const map = {};
    menuItems.forEach((item) => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    return CATEGORIES.map((cat) => ({ name: cat, items: map[cat] || [] }));
  }, [menuItems]);

  // Tampilan jika sudah ada pesanan aktif
  if (activeOrder) {
    return (
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <h2 style={{ margin: 0 }}>Meja {tableNumber}</h2>
          <p style={{ color: '#666', fontSize: '14px' }}>Pesanan sedang diproses</p>
        </div>

        <div style={styles.statusBox}>
          <h3 style={styles.statusTitle}>Status: {activeOrder.status.toUpperCase()}</h3>
          {activeOrder.items.map((item, i) => (
            <div key={i} style={styles.orderItem}>
              <span>{item.name} x {item.quantity}</span>
              <span style={{ color: item.status === 'served' ? '#2ecc71' : '#f39c12', fontWeight: 'bold' }}>
                {item.status === 'served' ? "✅ Disajikan" : "⏳ Dimasak"}
              </span>
            </div>
          ))}
          <div style={styles.totalRow}>
            <strong>Total: Rp {activeOrder.totalPrice.toLocaleString()}</strong>
          </div>
        </div>
        <p style={styles.footerNote}>* Silakan hubungi kasir untuk penambahan atau pembayaran.</p>
      </div>
    );
  }

  // Tampilan Menu Utama
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={styles.pageTitle}>Warung Ndeso - Meja {tableNumber}</h2>
        {menuByCategory.map((cat) => cat.items.length > 0 && (
          <div key={cat.name} style={{ marginBottom: '25px' }}>
            <h3 style={styles.categoryTitle}>{cat.name}</h3>
            {cat.items.map((item) => (
              <MenuItem key={item._id} item={item} qty={cart[item._id] || 0} onAdd={addToCart} onRemove={removeFromCart} />
            ))}
          </div>
        ))}
      </div>

      {Object.keys(cart).length > 0 && (
        <div style={styles.cartBar}>
          <div>
            <span style={{ fontSize: '12px', color: '#666' }}>Total Harga</span>
            <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#c0392b' }}>Rp {totalPrice.toLocaleString()}</div>
          </div>
          <button style={styles.checkoutBtn} onClick={handleOrder} disabled={isOrdering}>
            {isOrdering ? "Memproses..." : "PESAN SEKARANG"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ================= SUB-COMPONENTS ================= */
const MenuItem = React.memo(({ item, qty, onAdd, onRemove }) => (
  <div style={styles.menuCard}>
    <img 
      src={item.image_url?.startsWith("http") ? item.image_url : `https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev/uploads/${item.image_url || "no-image.png"}`} 
      alt={item.name} 
      style={styles.menuImage} 
    />
    <div style={{ flex: 1 }}>
      <b style={{ fontSize: '16px' }}>{item.name}</b>
      <div style={styles.priceText}>Rp {item.price.toLocaleString()}</div>
    </div>
    <div style={styles.actionArea}>
      {qty > 0 ? (
        <div style={styles.qtyControl}>
          <button style={styles.qtyBtn} onClick={() => onRemove(item)}>-</button>
          <span style={{ fontWeight: 'bold' }}>{qty}</span>
          <button style={styles.qtyBtn} onClick={() => onAdd(item)}>+</button>
        </div>
      ) : (
        <button style={styles.addBtn} onClick={() => onAdd(item)}>Tambah</button>
      )}
    </div>
  </div>
));

/* ================= STYLES ================= */
const styles = {
  page: { background: '#f8f9fa', minHeight: '100vh', paddingBottom: '80px' },
  container: { padding: '20px', maxWidth: '500px', margin: '0 auto' },
  pageTitle: { textAlign: 'center', color: '#2c3e50', marginBottom: '20px' },
  categoryTitle: { borderLeft: '4px solid #c0392b', paddingLeft: '10px', color: '#c0392b', marginBottom: '15px' },
  menuCard: { display: 'flex', gap: '15px', background: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', alignItems: 'center' },
  menuImage: { width: '70px', height: '70px', borderRadius: '10px', objectFit: 'cover' },
  priceText: { color: '#c0392b', fontWeight: 'bold', marginTop: '4px' },
  qtyControl: { display: 'flex', alignItems: 'center', gap: '12px', background: '#f1f2f6', borderRadius: '20px', padding: '4px 8px' },
  qtyBtn: { width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', fontWeight: 'bold' },
  addBtn: { padding: '6px 16px', borderRadius: '20px', border: '1px solid #c0392b', background: '#fff', color: '#c0392b', fontWeight: 'bold', cursor: 'pointer' },
  cartBar: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -4px 10px rgba(0,0,0,0.1)', zIndex: 100 },
  checkoutBtn: { background: '#c0392b', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
  statusBox: { background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
  statusTitle: { margin: '0 0 15px 0', textAlign: 'center', color: '#2c3e50' },
  orderItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f1f1' },
  totalRow: { marginTop: '15px', textAlign: 'right', borderTop: '2px dashed #eee', paddingTop: '10px', fontSize: '18px' },
  footerNote: { textAlign: 'center', fontSize: '12px', color: '#95a5a6', marginTop: '15px' }
};

export default OrderMenu;
