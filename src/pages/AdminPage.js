import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import {
  Loader,
  Package,
  Boxes,
  Plus,
  Trash,
  Image as ImageIcon,
  ChefHat,
  TrendingUp,
  DollarSign,
  ClipboardList,
  Clock,
} from "lucide-react";

const socket = io(
  "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev",
  { transports: ["websocket"] }
);

const API_BASE =
  "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev/api";

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    desc: "",
    category: "Makanan",
    imageFile: null,
  });
  const [imagePreview, setImagePreview] = useState(null);

  /* ================== HELPERS ================== */
  const splitItemsByCategory = (items = []) => ({
    makanan: items.filter((i) => i.category !== "Minuman"),
    minuman: items.filter((i) => i.category === "Minuman"),
  });

  /* ================== FETCH ================== */
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/orders`);
      setOrders(res.data.reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    const res = await axios.get(`${API_BASE}/menu`);
    setProducts(res.data);
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchProducts();

    socket.on("order:new", fetchOrders);
    socket.on("order:update", fetchOrders);

    return () => {
      socket.off("order:new", fetchOrders);
      socket.off("order:update", fetchOrders);
    };
  }, [fetchOrders, fetchProducts]);

  /* ================== ORDER STATUS ================== */
  const handleUpdateStatus = async (orderId, status, type) => {
    setOrders((prev) =>
      prev.map((o) =>
        o._id === orderId
          ? {
              ...o,
              ...(type === "food"
                ? { foodStatus: status }
                : { drinkStatus: status }),
            }
          : o
      )
    );

    try {
      await axios.put(`${API_BASE}/orders/${orderId}/status`, {
        status,
        type, // "food" | "drink"
      });
    } catch {
      alert("Gagal update status");
      fetchOrders();
    }
  };

  /* ================== PRODUCT ================== */
  const handleSelectImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNewProduct({ ...newProduct, imageFile: file });
    setImagePreview(URL.createObjectURL(file));
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries({
      name: newProduct.name,
      price: newProduct.price,
      description: newProduct.desc,
      category: newProduct.category,
    }).forEach(([k, v]) => fd.append(k, v));

    if (newProduct.imageFile) fd.append("image", newProduct.imageFile);

    await axios.post(`${API_BASE}/menu`, fd);
    fetchProducts();
    setNewProduct({
      name: "",
      price: "",
      desc: "",
      category: "Makanan",
      imageFile: null,
    });
    setImagePreview(null);
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm("Hapus menu ini?")) return;
    await axios.delete(`${API_BASE}/menu/${id}`);
    fetchProducts();
  };

  /* ================== UI ================== */
  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>
              <ChefHat color="white" />
            </div>
            <h2>Admin Dash</h2>
          </div>

          <div style={styles.tabWrapper}>
            <button
              onClick={() => setActiveTab("orders")}
              style={styles.tabBtn(activeTab === "orders")}
            >
              <ClipboardList size={16} /> Pesanan
            </button>
            <button
              onClick={() => setActiveTab("products")}
              style={styles.tabBtn(activeTab === "products")}
            >
              <Boxes size={16} /> Menu
            </button>
          </div>
        </div>
      </div>

      <div style={styles.container}>
        {/* ORDERS */}
        {activeTab === "orders" && (
          <div style={styles.ordersGrid}>
            {isLoading && <Loader />}
            {orders.map((o) => {
              const { makanan, minuman } = splitItemsByCategory(o.items);
              return (
                <div key={o._id} style={styles.orderCard}>
                  <div style={{ padding: 20 }}>
                    <b>Meja {o.tableNumber}</b>

                    <div style={styles.itemList}>
                      {makanan.length > 0 && (
                        <>
                          <b>🍽 Makanan</b>
                          {makanan.map((i, idx) => (
                            <div key={idx}>{i.quantity}x {i.name}</div>
                          ))}
                        </>
                      )}

                      {minuman.length > 0 && (
                        <>
                          <b>🥤 Minuman</b>
                          {minuman.map((i, idx) => (
                            <div key={idx}>{i.quantity}x {i.name}</div>
                          ))}
                        </>
                      )}
                    </div>

                    <div style={styles.orderActions}>
                      {makanan.length > 0 && (
                        <button
                          disabled={o.foodStatus === "cooking"}
                          style={styles.actionBtnDisabled(
                            o.foodStatus !== "cooking"
                          )}
                          onClick={() =>
                            handleUpdateStatus(o._id, "cooking", "food")
                          }
                        >
                          Masak Makanan
                        </button>
                      )}

                      {minuman.length > 0 && (
                        <button
                          disabled={o.drinkStatus === "served"}
                          style={styles.actionBtnDisabled(
                            o.drinkStatus !== "served"
                          )}
                          onClick={() =>
                            handleUpdateStatus(o._id, "served", "drink")
                          }
                        >
                          Siapkan Minuman
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PRODUCTS */}
        {activeTab === "products" && (
          <div style={styles.productGrid}>
            {products.map((p) => (
              <div key={p._id} style={styles.productCard}>
                <img
                  src={p.image_url || "/no-image.png"}
                  style={{ width: "100%", height: 120, objectFit: "cover" }}
                />
                <div style={{ padding: 10 }}>
                  <b>{p.name}</b>
                  <p>Rp {p.price?.toLocaleString()}</p>
                  <button onClick={() => handleDeleteProduct(p._id)}>
                    <Trash size={14} /> Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ================== STYLES ================== */
const styles = {
  page: { background: "#F8F9FA", minHeight: "100vh" },
  container: { maxWidth: 1200, margin: "auto", padding: 20 },
  header: { background: "white", borderBottom: "1px solid #ddd" },
  headerContent: {
    display: "flex",
    justifyContent: "space-between",
    padding: 15,
  },
  logoArea: { display: "flex", gap: 10, alignItems: "center" },
  logoIcon: { background: "#5E4A3A", padding: 8, borderRadius: 8 },
  tabWrapper: { display: "flex", gap: 10 },
  tabBtn: (active) => ({
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: active ? "#5E4A3A" : "#eee",
    color: active ? "white" : "#333",
  }),
  ordersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
    gap: 20,
  },
  orderCard: {
    background: "white",
    borderRadius: 12,
    border: "1px solid #ddd",
  },
  itemList: { margin: "10px 0" },
  orderActions: { display: "flex", gap: 8, marginTop: 10 },
  actionBtnDisabled: (active) => ({
    padding: 8,
    borderRadius: 8,
    border: "none",
    background: active ? "#ddd" : "#f1f1f1",
    cursor: active ? "pointer" : "not-allowed",
  }),
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
    gap: 20,
  },
  productCard: {
    background: "white",
    border: "1px solid #ddd",
    borderRadius: 10,
  },
};

export default AdminPage;
