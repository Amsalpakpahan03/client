import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import socket from "../api/socket";
import { useMenu } from "../hooks/useMenu";
import { useOrder } from "../hooks/useOrder";

/* ================= CONSTANT ================= */
const CATEGORIES = ["Paket", "Makanan", "Minuman", "Cemilan"];

function OrderMenu() {
  /* ================= REFS (PENTING) ================= */
  const hasInitSocket = useRef(false);
  const heartbeatRef = useRef(null);

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

  /* ================= SOCKET LOCK & HEARTBEAT ================= */
  useEffect(() => {
    if (!tableNumber || hasInitSocket.current) return;

    hasInitSocket.current = true;

    socket.emit("tryAccessTable", {
      tableId: tableNumber,
      clientId,
    });

    const denyHandler = (data) => {
      setIsLocked(true);
      alert(data.message);
    };

    socket.on("accessDenied", denyHandler);

    heartbeatRef.current = setInterval(() => {
      socket.emit("heartbeat", {
        tableId: tableNumber,
        clientId,
      });
    }, 5000);

    return () => {
      clearInterval(heartbeatRef.current);
      socket.off("accessDenied", denyHandler);
      hasInitSocket.current = false;
    };
  }, [tableNumber, clientId]);

  /* ================= REALTIME ORDER UPDATE ================= */
  useEffect(() => {
    if (!tableNumber) return;

    const handler = (updatedOrder) => {
      if (updatedOrder.tableNumber !== tableNumber) return;
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

  /* ================= STATUS VIEW ================= */
  if (activeOrder) {
    return (
      <div style={styles.container}>
        <h2>Warung Ndeso – Meja {tableNumber}</h2>
        <h3>Status: {activeOrder.status}</h3>

        <ul>
          {activeOrder.items.map((item, i) => (
            <li key={i}>
              {item.name} × {item.quantity}
            </li>
          ))}
        </ul>

        <b>Total: Rp {activeOrder.totalPrice.toLocaleString()}</b>
      </div>
    );
  }

  /* ================= MENU VIEW ================= */
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

/* ================= MENU ITEM ================= */
const ASSET_URL = process.env.REACT_APP_ASSET_URL;

const MenuItem = React.memo(({ item, qty, onAdd, onRemove }) => (
  <div style={styles.menuCard}>
    <img
      src={
        item.image_url?.startsWith("http")
          ? item.image_url
          : `${ASSET_URL}/uploads/${item.image_url || "no-image.png"}`
      }
      alt={item.name}
      style={styles.menuImage}
    />

    <div style={{ flex: 1 }}>
      <b>{item.name}</b>
      <div style={styles.price}>Rp {item.price.toLocaleString()}</div>
    </div>

    <div style={styles.action}>
      {qty ? (
        <>
          <button onClick={() => onRemove(item)}>−</button>
          {qty}
          <button onClick={() => onAdd(item)}>+</button>
        </>
      ) : (
        <button onClick={() => onAdd(item)}>Tambah</button>
      )}
    </div>
  </div>
));

/* ================= STYLES ================= */
const styles = {
  container: { padding: 20, maxWidth: 480, margin: "0 auto" },
  category: { borderBottom: "2px solid #c0392b", marginTop: 20 },
  menuCard: { display: "flex", gap: 10, marginBottom: 10 },
  menuImage: { width: 80, height: 80, borderRadius: 8 },
  price: { color: "#c0392b", fontWeight: "bold" },
  action: { display: "flex", gap: 6, alignItems: "center" },
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
};

export default OrderMenu;
