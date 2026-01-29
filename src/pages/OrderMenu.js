import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import socket from "../api/socket";
import { useMenu } from "../hooks/useMenu";
import { useOrder } from "../hooks/useOrder";

/* ================= CONSTANT ================= */
const CATEGORIES = ["Paket", "Makanan", "Minuman", "Cemilan"];

function OrderMenu() {
  /* ================= URL PARAM ================= */
  const location = useLocation();
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const tableNumber = query.get("table");

  /* ================= HOOKS ================= */
  const { menuItems = [] } = useMenu();
  const {
    activeOrder,
    createOrder,
    updateOrderFromSocket,
  } = useOrder(tableNumber);

  /* ================= STATE ================= */
  const [orderToken, setOrderToken] = useState(null);
  const [cart, setCart] = useState({});
  const [isLocked, setIsLocked] = useState(false);

  /* ================= CLIENT ID ================= */
  const clientId = useMemo(() => {
    let id = localStorage.getItem("order_client_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("order_client_id", id);
    }
    return id;
  }, []);

  /* ================= TOKEN ================= */
  useEffect(() => {
    const tokenFromUrl = query.get("token");
    if (tokenFromUrl) {
      localStorage.setItem("order_token", tokenFromUrl);
      setOrderToken(tokenFromUrl);
    } else {
      setOrderToken(localStorage.getItem("order_token"));
    }
  }, [query]);

  /* ================= TABLE LOCK ================= */
  useEffect(() => {
    if (!tableNumber) return;

    socket.emit("tryAccessTable", {
      tableId: tableNumber,
      clientId,
    });

    const denyHandler = (data) => {
      setIsLocked(true);
      alert(data.message);
    };

    socket.on("accessDenied", denyHandler);

    const heartbeat = setInterval(() => {
      socket.emit("heartbeat", {
        tableId: tableNumber,
        clientId,
      });
    }, 5000);

    return () => {
      clearInterval(heartbeat);
      socket.off("accessDenied", denyHandler);
    };
  }, [tableNumber, clientId]);

  /* ================= REALTIME ORDER UPDATE (FIXED) ================= */
  useEffect(() => {
    if (!tableNumber) return;

    // JOIN ROOM
    socket.emit("joinTable", tableNumber);

   const handler = (updatedOrder) => {
  // Gunakan String() untuk memastikan perbandingan tipe data yang sama
  if (String(updatedOrder.tableNumber) !== String(tableNumber)) return;
  updateOrderFromSocket(updatedOrder);
};

    socket.on("orderStatusUpdated", handler);

    return () => {
      socket.off("orderStatusUpdated", handler);
      socket.emit("leaveTable", tableNumber);
    };
  }, [tableNumber, updateOrderFromSocket]);

  /* ================= CART ACTION ================= */
  const addToCart = useCallback((item) => {
    setCart((prev) => ({
      ...prev,
      [item._id]: (prev[item._id] || 0) + 1,
    }));
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

  /* ================= TOTAL PRICE ================= */
  const totalPrice = useMemo(() => {
    return menuItems.reduce(
      (sum, item) =>
        sum + (cart[item._id] || 0) * (item.price || 0),
      0
    );
  }, [cart, menuItems]);

  /* ================= CREATE ORDER ================= */
  const handleOrder = async () => {
    if (isLocked) return alert("Meja masih terkunci");
    if (!tableNumber) return alert("QR tidak valid");
    if (!orderToken) return alert("Token belum tersedia");
    if (!Object.keys(cart).length)
      return alert("Pilih menu dulu");

    const items = menuItems
      .filter((m) => cart[m._id])
      .map((m) => ({
        name: m.name,
        quantity: cart[m._id],
        price: m.price,
        category: m.category,
      }));

    await createOrder({
      tableNumber,
      items,
      totalPrice,
    });

    setCart({});
  };

  /* ================= MENU GROUPING ================= */
  const menuByCategory = useMemo(() => {
    const map = {};
    for (const item of menuItems) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }

    return CATEGORIES.map((cat) => ({
      name: cat,
      items: map[cat] || [],
    }));
  }, [menuItems]);

  /* ================= STATUS ================= */
  const getStatusInfo = (status) => {
    switch (status) {
      case "pending":
        return {
          text: "Menunggu Konfirmasi",
          color: "#c0392b",
          bg: "#fdecea",
        };
      case "cooking":
        return {
          text: "Sedang Dimasak",
          color: "#e67e22",
          bg: "#fdf2e9",
        };
      case "served":
        return {
          text: "Pesanan Diantar",
          color: "#27ae60",
          bg: "#e9f7ef",
        };
      default:
        return {};
    }
  };

  /* ================= VIEW: ORDER STATUS ================= */
  /* ================= VIEW: ORDER STATUS ================= */
  if (activeOrder) {
    const status = getStatusInfo(activeOrder.status);

    // Kelompokkan item berdasarkan kategori untuk tampilan status
    const itemsByCategory = activeOrder.items.reduce((acc, item) => {
      // Gunakan properti category dari database (pastikan model sudah diupdate)
      const cat = item.category || "Lainnya"; 
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    return (
      <div style={styles.container}>
        <h2>Warung Ndeso – Meja {tableNumber}</h2>

        <div
          style={{
            ...styles.statusBox,
            borderColor: status.color,
            background: status.bg,
          }}
        >
          <h3 style={{ marginBottom: 15 }}>Status Utama: {status.text}</h3>

          {/* Render status per kelompok kategori */}
          {Object.entries(itemsByCategory).map(([category, items]) => (
            <div key={category} style={{ marginBottom: 15, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.5)' }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#555', borderBottom: '1px solid #ddd' }}>
                {category}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '3px' }}>
                    <span>{item.name} × {item.quantity}</span>
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: item.status === 'served' ? '#27ae60' : '#e67e22' 
                    }}>
                      {item.status === 'served' ? "✅ Siap" : "🍳 Proses"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div style={{ marginTop: 15, paddingTop: 10, borderTop: '2px dashed #ccc' }}>
            <b>Total: Rp {activeOrder.totalPrice.toLocaleString()}</b>
          </div>
        </div>
        
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#7f8c8d', marginTop: 10 }}>
          * Minuman biasanya diantar lebih awal.
        </p>
      </div>
    );
  }
  /* ================= VIEW: MENU ================= */
  return (
    <div style={styles.container}>
      <h2>Warung Ndeso – Meja {tableNumber}</h2>

      {menuByCategory.map(
        (cat) =>
          cat.items.length > 0 && (
            <div key={cat.name}>
              <h3 style={styles.category}>{cat.name}</h3>

              {cat.items.map((item) => (
                <MenuItem
                  key={item._id}
                  item={item}
                  qty={cart[item._id] || 0}
                  onAdd={addToCart}
                  onRemove={removeFromCart}
                />
              ))}
            </div>
          )
      )}

      {!!Object.keys(cart).length && (
        <div style={styles.cartBar}>
          <b>Rp {totalPrice.toLocaleString()}</b>
          <button
            style={styles.checkoutBtn}
            onClick={handleOrder}
          >
            PESAN
          </button>
        </div>
      )}
    </div>
  );
}

/* ================= MEMOIZED MENU ITEM ================= */
const ASSET_URL = process.env.REACT_APP_ASSET_URL;

const MenuItem = React.memo(function MenuItem({
  item,
  qty,
  onAdd,
  onRemove,
}) {
  return (
    <div style={styles.menuCard}>
      <img
        src={
          item.image_url?.startsWith("http")
            ? item.image_url
            : `${ASSET_URL}/uploads/${
                item.image_url || "no-image.png"
              }`
        }
        alt={item.name}
        width="80"
        height="80"
        loading="lazy"
        style={styles.menuImage}
      />

      <div style={{ flex: 1 }}>
        <b>{item.name}</b>
        <div style={styles.price}>
          Rp {item.price.toLocaleString()}
        </div>
      </div>

      <div style={styles.action}>
        {qty ? (
          <>
            <button
              style={styles.qtyBtn}
              onClick={() => onRemove(item)}
            >
              −
            </button>
            {qty}
            <button
              style={styles.qtyBtn}
              onClick={() => onAdd(item)}
            >
              +
            </button>
          </>
        ) : (
          <button
            style={styles.addBtn}
            onClick={() => onAdd(item)}
          >
            Tambah
          </button>
        )}
      </div>
    </div>
  );
});

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
