import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import {
  ChefHat,
  ClipboardList,
  Boxes,
  Clock,
  TrendingUp,
  DollarSign,
  Package,
} from "lucide-react";

/* ================= CONFIG ================= */
const API_BASE =
  "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev/api";

const socket = io(
  "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev",
  { transports: ["websocket"] }
);

/* ================= COMPONENT ================= */
export default function AdminPage() {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const ordersRef = useRef([]);
  const audioRef = useRef(null);

  /* ================= HELPERS ================= */
  const syncOrders = (data) => {
    ordersRef.current = data;
    setOrders(data);
  };

  const playSound = () => {
    audioRef.current?.play().catch(() => {});
  };

  /* ================= FETCH ================= */
  const fetchOrders = useCallback(async () => {
    const res = await axios.get(`${API_BASE}/orders`);
    const active = res.data
      .filter((o) => o.status !== "paid")
      .reverse();
    syncOrders(active);
  }, []);

  const fetchProducts = useCallback(async () => {
    const res = await axios.get(`${API_BASE}/menu`);
    setProducts(res.data);
  }, []);

  /* ================= SOCKET ================= */
  useEffect(() => {
    fetchOrders();
    fetchProducts();

    socket.on("order:new", (order) => {
      playSound();
      syncOrders([order, ...ordersRef.current]);
    });

    socket.on("order:update", (updated) => {
      syncOrders(
        ordersRef.current.map((o) =>
          o._id === updated._id ? updated : o
        )
      );
    });

    return () => {
      socket.off("order:new");
      socket.off("order:update");
    };
  }, [fetchOrders, fetchProducts]);

  /* ================= ACTIONS ================= */
  const updateItemStatus = async (orderId, itemId, status) => {
    await axios.put(
      `${API_BASE}/orders/${orderId}/items/${itemId}`,
      { status }
    );
  };

  /* ================= UI ================= */
  return (
    <div style={styles.page}>
      <audio ref={audioRef} src="/notif.mp3" />

      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <ChefHat /> Admin Dapur
        </div>
        <div style={styles.tabs}>
          <button onClick={() => setTab("orders")}>Pesanan</button>
          <button onClick={() => setTab("products")}>Menu</button>
        </div>
      </header>

      {/* STATS */}
      <div style={styles.stats}>
        <Stat icon={<TrendingUp />} label="Pesanan Aktif" value={orders.length} />
        <Stat
          icon={<DollarSign />}
          label="Estimasi Omzet"
          value={
            "Rp " +
            orders.reduce((a, c) => a + (c.totalPrice || 0), 0).toLocaleString()
          }
        />
        <Stat icon={<Package />} label="Menu" value={products.length} />
      </div>

      {/* ORDERS */}
      {tab === "orders" && (
        <div style={styles.grid}>
          {orders.map((o) => (
            <OrderCard
              key={o._id}
              order={o}
              onUpdateItem={updateItemStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= SUB COMPONENTS ================= */

function OrderCard({ order, onUpdateItem }) {
  const foods = order.items.filter((i) => i.category !== "Minuman");
  const drinks = order.items.filter((i) => i.category === "Minuman");

  return (
    <div style={styles.card}>
      <header style={styles.cardHeader}>
        <Clock size={14} />
        <span>
          {new Date(order.createdAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <b style={styles.meja}>Meja {order.tableNumber}</b>
      </header>

      {/* MINUMAN */}
      {drinks.length > 0 && (
        <>
          <h4>🥤 Minuman</h4>
          {drinks.map((i) => (
            <Row
              key={i._id}
              item={i}
              actionLabel="Antar"
              onClick={() =>
                onUpdateItem(order._id, i._id, "served")
              }
            />
          ))}
        </>
      )}

      {/* MAKANAN */}
      {foods.length > 0 && (
        <>
          <h4>🍳 Makanan</h4>
          {foods.map((i) => (
            <Row
              key={i._id}
              item={i}
              actionLabel={i.status === "pending" ? "Masak" : "Antar"}
              onClick={() =>
                onUpdateItem(
                  order._id,
                  i._id,
                  i.status === "pending" ? "cooking" : "served"
                )
              }
            />
          ))}
        </>
      )}

      <footer style={styles.total}>
        Rp {order.totalPrice?.toLocaleString()}
      </footer>
    </div>
  );
}

function Row({ item, actionLabel, onClick }) {
  return (
    <div style={styles.row}>
      <span>
        {item.quantity}x {item.name}
      </span>
      {item.status !== "served" && (
        <button onClick={onClick}>{actionLabel}</button>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div style={styles.stat}>
      {icon}
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const styles = {
  page: { padding: 20, background: "#f9fafb", minHeight: "100vh" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  logo: { fontWeight: "bold", fontSize: 20, display: "flex", gap: 8 },
  tabs: { display: "flex", gap: 10 },
  stats: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 },
  stat: {
    background: "#fff",
    padding: 15,
    borderRadius: 12,
    display: "flex",
    gap: 10,
  },
  grid: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
    gap: 15,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 15,
  },
  cardHeader: { display: "flex", gap: 10, alignItems: "center" },
  meja: { background: "#5E4A3A", color: "#fff", padding: "4px 10px" },
  row: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  total: {
    marginTop: 10,
    fontWeight: "bold",
    color: "#EA580C",
  },
};
