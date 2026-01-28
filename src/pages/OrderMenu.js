import React, { useEffect, useState, useMemo, useCallback } from "react";
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
    [location.search],
  );

  const tableNumber = query.get("table");

  /* ================= HOOKS ================= */
  const { menuItems = [] } = useMenu();
  const { activeOrder, createOrder, updateOrderFromSocket } =
    useOrder(tableNumber);

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

  /* ================= LOCKING ================= */
  // useEffect(() => {
  //   if (!tableNumber) return;

  //   socket.emit("tryAccessTable", {
  //     tableId: tableNumber,
  //     clientId,
  //   });

  //   const denyHandler = (data) => {
  //     setIsLocked(true);
  //     alert(data.message);
  //   };

  //   socket.on("accessDenied", denyHandler);

  //   const heartbeat = setInterval(() => {
  //     socket.emit("heartbeat", {
  //       tableId: tableNumber,
  //       clientId,
  //     });
  //   }, 5000);

  //   return () => {
  //     clearInterval(heartbeat);
  //     socket.off("accessDenied", denyHandler);
  //   };
  // }, [tableNumber, clientId]);
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

  // /* ================= SOCKET UPDATE ================= */
  // useEffect(() => {
  //   const handler = (updatedOrder) => {
  //     if (updatedOrder.tableNumber !== tableNumber) return;
  //     updateOrderFromSocket(updatedOrder);
  //   };

  //   socket.on("orderStatusUpdated", handler);
  //   return () => socket.off("orderStatusUpdated", handler);
  // }, [tableNumber, updateOrderFromSocket]);
  /* ================= SOCKET UPDATE ================= */
useEffect(() => {
  if (!tableNumber) return;

  // PENTING: Beritahu server untuk memasukkan kita ke room meja ini
  socket.emit("joinTable", tableNumber);

  const handler = (updatedOrder) => {
    // Debugging: Cek apakah data masuk ke console
    console.log("Socket Update Received:", updatedOrder);
    
    if (String(updatedOrder.tableNumber) !== String(tableNumber)) return;
    updateOrderFromSocket(updatedOrder);
  };

  socket.on("orderStatusUpdated", handler);
  
  return () => {
    socket.off("orderStatusUpdated", handler);
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
      (sum, item) => sum + (cart[item._id] || 0) * (item.price || 0),
      0,
    );
  }, [cart, menuItems]);

  /* ================= CREATE ORDER ================= */
  const handleOrder = async () => {
    if (isLocked) return alert("Meja masih terkunci");
    if (!tableNumber) return alert("QR tidak valid");
    if (!orderToken) return alert("Token belum tersedia");
    if (!Object.keys(cart).length) return alert("Pilih menu dulu");

    const items = menuItems
      .filter((m) => cart[m._id])
      .map((m) => ({
        name: m.name,
        quantity: cart[m._id],
        price: m.price,
      }));

    await createOrder({
      tableNumber,
      items,
      totalPrice,
    });

    setCart({});
  };

  /* ================= MENU GROUPING (1 PASS) ================= */
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
  if (activeOrder) {
    const status = getStatusInfo(activeOrder.status);

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
          <h3>{status.text}</h3>

          <ul>
            {activeOrder.items.map((item, i) => (
              <li key={i}>
                {item.name} × {item.quantity} = Rp{" "}
                {(item.price * item.quantity).toLocaleString()}
              </li>
            ))}
          </ul>

          <b>Total: Rp {activeOrder.totalPrice.toLocaleString()}</b>
        </div>
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
          ),
      )}

      {!!Object.keys(cart).length && (
        <div style={styles.cartBar}>
          <b>Rp {totalPrice.toLocaleString()}</b>
          <button style={styles.checkoutBtn} onClick={handleOrder}>
            PESAN
          </button>
        </div>
      )}
    </div>
  );
}

/* ================= MEMOIZED MENU ITEM ================= */
const API_URL = process.env.REACT_APP_API_URL;
const ASSET_URL = process.env.REACT_APP_ASSET_URL;

const MenuItem = React.memo(function MenuItem({ item, qty, onAdd, onRemove }) {
  return (
    <div style={styles.menuCard}>
      <img
        src={
          item.image_url?.startsWith("http")
            ? item.image_url
            : `${ASSET_URL}/uploads/${item.image_url || "no-image.png"}`
        }
        alt={item.name}
        width="80"
        height="80"
        loading="lazy"
        decoding="async"
        style={styles.menuImage}
      />

      <div style={{ flex: 1 }}>
        <b>{item.name}</b>
        <div style={styles.price}>Rp {item.price.toLocaleString()}</div>
      </div>

      <div style={styles.action}>
        {qty ? (
          <>
            <button style={styles.qtyBtn} onClick={() => onRemove(item)}>
              −
            </button>
            {qty}
            <button style={styles.qtyBtn} onClick={() => onAdd(item)}>
              +
            </button>
          </>
        ) : (
          <button style={styles.addBtn} onClick={() => onAdd(item)}>
            Tambah
          </button>
        )}
      </div>
    </div>
  );
});

/* ================= STYLES ================= */
const styles = {
  container: { padding: 20, maxWidth: 480, margin: "0 auto" },
  category: { borderBottom: "2px solid #c0392b", marginTop: 20 },
  menuCard: { display: "flex", gap: 10, marginBottom: 10 },
  menuImage: { width: 80, height: 80, borderRadius: 8 },
  price: { color: "#c0392b", fontWeight: "bold" },
  action: { display: "flex", gap: 6, alignItems: "center" },
  qtyBtn: { width: 28, height: 28 },
  addBtn: { padding: "6px 12px" },
  cartBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    background: "#fff",
    display: "flex",
    justifyContent: "space-between",
  },
  checkoutBtn: { padding: "10px 24px" },
  statusBox: { padding: 20, border: "2px solid", borderRadius: 10 },
};

export default OrderMenu;
