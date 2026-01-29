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

// const socket = io("http://localhost:5000");
const socket = io(
  "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev",
  {
    transports: ["websocket"],
  }
);


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

  // const API_BASE = "http://localhost:5000/api";
    const API_BASE = "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev/api";

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/orders`);
      setOrders(res.data.reverse());
    } catch (err) {
      console.error("Gagal mengambil data pesanan", err);
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/menu`);
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [API_BASE]);

  // useEffect(() => {
  //   fetchOrders();
  //   fetchProducts();
  //   socket.on("newOrder", fetchOrders);
  //   socket.on("orderStatusChanged", fetchOrders);
  //   return () => {
  //     socket.off("newOrder");
  //     socket.off("orderStatusChanged");
  //   };
  // }, [fetchOrders, fetchProducts]);
  useEffect(() => {
  fetchOrders();

  socket.on("order:new", fetchOrders);
  socket.on("order:update", fetchOrders);

  return () => {
    socket.off("order:new", fetchOrders);
    socket.off("order:update", fetchOrders);
  };
}, [fetchOrders]);


  const handleUpdateStatus = async (id, newStatus) => {
    // 1. UPDATE UI LANGSUNG (optimistic)
    setOrders((prev) =>
      prev.map((o) => (o._id === id ? { ...o, status: newStatus } : o))
    );

    try {
      // 2. KIRIM KE BACKEND
      await axios.put(`${API_BASE}/orders/${id}/status`, { status: newStatus });
      // 3. Emit socket supaya realtime
      // socket.emit("orderStatusChanged", { _id: id, status: newStatus });
    } catch (err) {
      // 4. ROLLBACK jika gagal
      alert("Gagal update status");
      fetchOrders();
    }
  };

  const handleSelectImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNewProduct({ ...newProduct, imageFile: file });
    setImagePreview(URL.createObjectURL(file));
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", newProduct.name);
    formData.append("price", newProduct.price);
    formData.append("description", newProduct.desc);
    formData.append("category", newProduct.category);
    if (newProduct.imageFile) formData.append("image", newProduct.imageFile);

    try {
      await axios.post(`${API_BASE}/menu`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Produk berhasil ditambahkan!");
      setNewProduct({
        name: "",
        price: "",
        desc: "",
        category: "Makanan",
        imageFile: null,
      });
      setImagePreview(null);
      fetchProducts();
    } catch (err) {
      alert(err.message);
    }
  };

  const splitItemsByCategory = (items = []) => ({
  makanan: items.filter((i) => i.category !== "Minuman"),
  minuman: items.filter((i) => i.category === "Minuman"),
});
{(() => {
  const { makanan, minuman } = splitItemsByCategory(o.items);

  return (
    <>
      {makanan.length > 0 && (
        <>
          <b>🍽 Makanan</b>
          {makanan.map((item, idx) => (
            <div key={idx} style={styles.itemRow}>
              <b>{item.quantity}x</b> {item.name}
            </div>
          ))}
        </>
      )}

      {minuman.length > 0 && (
        <>
          <b>🥤 Minuman</b>
          {minuman.map((item, idx) => (
            <div key={idx} style={styles.itemRow}>
              <b>{item.quantity}x</b> {item.name}
            </div>
          ))}
        </>
      )}
    </>
  );
})()}


  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Yakin ingin menghapus produk ini?")) return;
    try {
      await axios.delete(`${API_BASE}/menu/${id}`);
      fetchProducts();
    } catch (err) {
      alert("Gagal menghapus");
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "pending":
        return {
          backgroundColor: "#FFFBEB",
          color: "#B45309",
          border: "1px solid #FDE68A",
        };
      case "cooking":
        return {
          backgroundColor: "#EFF6FF",
          color: "#1E40AF",
          border: "1px solid #BFDBFE",
        };
      case "served":
        return {
          backgroundColor: "#ECFDF5",
          color: "#065F46",
          border: "1px solid #A7F3D0",
        };
      case "paid":
        return {
          backgroundColor: "#F1F5F9",
          color: "#475569",
          border: "1px solid #E2E8F0",
        };
      default:
        return { backgroundColor: "#F3F4F6", color: "#374151" };
    }
  };

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>
              <ChefHat color="white" size={24} />
            </div>
            <div>
              <h1 style={styles.logoText}>Admin Dash</h1>
              <div style={styles.liveIndicator}>
                <span style={styles.pulseDot}></span>
                <span style={styles.liveText}>Live System</span>
              </div>
            </div>
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
        {/* Stats */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                color: "#F97316",
                backgroundColor: "#FFF7ED",
              }}
            >
              <TrendingUp />
            </div>
            <div>
              <p style={styles.statLabel}>Total Pesanan</p>
              <p style={styles.statValue}>{orders.length}</p>
            </div>
          </div>
          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                color: "#16A34A",
                backgroundColor: "#F0FDF4",
              }}
            >
              <DollarSign />
            </div>
            <div>
              <p style={styles.statLabel}>Estimasi Omzet</p>
              <p style={styles.statValue}>
                Rp{" "}
                {orders
                  .reduce((a, c) => a + (c.totalPrice || 0), 0)
                  .toLocaleString()}
              </p>
            </div>
          </div>
                
          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                color: "#7C3AED",
                backgroundColor: "#F5F3FF",
              }}
            >
              <Package />
            </div>
            <div>
              <p style={styles.statLabel}>Total Menu</p>
              <p style={styles.statValue}>{products.length}</p>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        {activeTab === "orders" ? (
          <div style={styles.ordersGrid}>
            {isLoading && orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <Loader className="animate-spin" />
              </div>
            ) : (
              orders.map((o) => (
                <div key={o._id} style={styles.orderCard}>
                  <div style={styles.orderCardContent}>
                    <div style={{ flex: 1 }}>
                      <div style={styles.orderHeader}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <Clock size={14} />
                          <span style={{ fontSize: 12, color: "#6B7280" }}>
                            {new Date(o.createdAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <span style={styles.tableBadge}>
                          Meja {o.tableNumber}
                        </span>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...getStatusStyle(o.status),
                          }}
                        >
                          {o.status === "pending"
                            ? "🔔 BARU"
                            : o.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={styles.itemList}>
                        {o.items.map((item, idx) => (
                          <div key={idx} style={styles.itemRow}>
                            <b style={{ color: "#5E4A3A" }}>{item.quantity}x</b>{" "}
                            {item.name}
                          </div>
                        ))}
                      </div>
                      <div style={styles.orderFooter}>
                        <span style={styles.orderId}>
                          #{o._id.slice(-6).toUpperCase()}
                        </span>
                        <span style={styles.orderTotal}>
                          Rp {o.totalPrice?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                   <div style={styles.orderActions}>
  {(() => {
    const { makanan, minuman } = splitItemsByCategory(o.items);
    const isPending = o.status === "pending";
    const isCooking = o.status === "cooking";

    return (
      <>
        {/* MAKANAN */}
        {makanan.length > 0 && (
          <button
            disabled={!isPending}
            style={styles.actionBtnDisabled(isPending)}
            onClick={() => handleUpdateStatus(o._id, "cooking")}
          >
            Masak Makanan
          </button>
        )}

        {/* MINUMAN */}
        {minuman.length > 0 && (
          <button
            disabled={!isPending}
            style={styles.actionBtnDisabled(isPending)}
            onClick={() => handleUpdateStatus(o._id, "served")}
          >
            Siapkan Minuman
          </button>
        )}

        {/* FINAL */}
        {isCooking && (
          <button
            style={styles.actionBtnDisabled(true)}
            onClick={() => handleUpdateStatus(o._id, "paid")}
          >
            Lunas
          </button>
        )}
      </>
    );
  })()}
</div>

        ) : (
          <div style={styles.productFlex}>
            {/* FORM TAMBAH MENU */}
            <div style={styles.productFormSide}>
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>
                  <Plus size={20} /> Tambah Menu
                </h3>
                <form onSubmit={handleAddProduct} style={styles.form}>
                  <div>
                    <label style={styles.label}>Nama Menu</label>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="Contoh: Nasi Goreng"
                      value={newProduct.name}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div style={styles.inputRow}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Harga (Rp)</label>
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="15000"
                        value={newProduct.price}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            price: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Kategori</label>
                      <select
                        style={styles.input}
                        value={newProduct.category}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            category: e.target.value,
                          })
                        }
                      >
                        <option value="Makanan">Makanan</option>
                        <option value="Cemilan">Cemilan</option>
                        <option value="Minuman">Minuman</option>
                        <option value="Paket">Paket</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={styles.label}>Deskripsi</label>
                    <textarea
                      style={{ ...styles.input, height: 80, resize: "none" }}
                      placeholder="Penjelasan singkat menu..."
                      value={newProduct.desc}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, desc: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Foto Produk</label>
                    <label style={styles.fileLabel}>
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleSelectImage}
                      />
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          style={{
                            width: "100%",
                            height: 100,
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <>
                          <ImageIcon size={24} color="#9CA3AF" />
                          <span
                            style={{
                              fontSize: 12,
                              color: "#9CA3AF",
                              marginTop: 5,
                            }}
                          >
                            Klik untuk upload
                          </span>
                        </>
                      )}
                    </label>
                  </div>

                  <button type="submit" style={styles.submitBtn}>
                    Simpan Menu
                  </button>
                </form>
              </div>
            </div>

            {/* LIST PRODUK */}
            <div style={styles.productListSide}>
              <div style={styles.productGrid}>
                {products.map((p) => (
                  <div key={p._id} style={styles.productCard}>
                    <div style={styles.productImageWrapper}>
                      <img
                        src={p.image_url || "/no-image.png"}
                        style={styles.productImage}
                        alt={p.name}
                      />
                    </div>
                    <div style={{ padding: 15 }}>
                      <h4 style={{ margin: 0 }}>{p.name}</h4>
                      <p style={styles.productPrice}>
                        Rp {p.price?.toLocaleString()}
                      </p>
                      <button
                        style={styles.deleteBtn}
                        onClick={() => handleDeleteProduct(p._id)}
                      >
                        <Trash size={14} /> Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    backgroundColor: "#F8F9FA",
    minHeight: "100vh",
    fontFamily: "sans-serif",
  },
  container: { maxWidth: 1200, margin: "0 auto", padding: "0 20px" },
  header: {
    backgroundColor: "white",
    borderBottom: "1px solid #E5E7EB",
    position: "sticky",
    top: 0,
    zIndex: 10,
    padding: "15px 0",
  },
  headerContent: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 15,
  },
  logoArea: { display: "flex", alignItems: "center", gap: 12 },
  logoIcon: { backgroundColor: "#5E4A3A", padding: 8, borderRadius: 8 },
  logoText: { margin: 0, fontSize: 24, fontWeight: "bold", color: "#5E4A3A" },
  liveIndicator: { display: "flex", alignItems: "center", gap: 5 },
  pulseDot: {
    width: 8,
    height: 8,
    backgroundColor: "#22C55E",
    borderRadius: "50%",
  },
  liveText: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  tabWrapper: {
    display: "flex",
    backgroundColor: "#F3F4F6",
    padding: 4,
    borderRadius: 12,
  },
  tabBtn: (active) => ({
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 14,
    backgroundColor: active ? "white" : "transparent",
    color: active ? "#5E4A3A" : "#6B7280",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
    transition: "0.3s",
  }),
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
    margin: "30px 0",
  },
  statCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 16,
    border: "1px solid #F3F4F6",
    display: "flex",
    alignItems: "center",
    gap: 15,
  },
  statIcon: { padding: 12, borderRadius: "50%" },
  statLabel: {
    margin: 0,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  statValue: { margin: 0, fontSize: 24, fontWeight: "bold", color: "#1F2937" },
  ordersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: 20,
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    overflow: "hidden",
  },
  orderCardContent: { padding: 20, display: "flex", gap: 20 },
  orderHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  tableBadge: {
    backgroundColor: "#5E4A3A",
    color: "white",
    padding: "4px 12px",
    borderRadius: 8,
    fontWeight: "bold",
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "900",
    padding: "4px 12px",
    borderRadius: 20,
  },
  itemList: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottom: "1px solid #F3F4F6",
  },
  itemRow: { fontSize: 14, color: "#4B5563", marginBottom: 5 },
  orderFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderId: { fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" },
  orderTotal: { fontSize: 18, fontWeight: "bold", color: "#EA580C" },
  orderActions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 100,
  },
  actionBtn: (bg, color) => ({
    backgroundColor: bg,
    color: color,
    border: "none",
    padding: 8,
    borderRadius: 8,
    fontWeight: "bold",
    fontSize: 10,
    cursor: "pointer",
    textTransform: "uppercase",
  }),
  productFlex: { display: "flex", gap: 30, flexWrap: "wrap" },
  productFormSide: { flex: 1, minWidth: 300 },
  formCard: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    position: "sticky",
    top: 100,
  },
  formTitle: {
    margin: "0 0 20px 0",
    color: "#5E4A3A",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  form: { display: "flex", flexDirection: "column", gap: 15 },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4B5563",
    marginBottom: 5,
    display: "block",
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #D1D5DB",
    boxSizing: "border-box",
  },
  inputRow: { display: "flex", gap: 15 },
  fileLabel: {
    border: "2px dashed #E5E7EB",
    padding: 15,
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
  },
  submitBtn: {
    backgroundColor: "#5E4A3A",
    color: "white",
    padding: 12,
    borderRadius: 8,
    border: "none",
    fontWeight: "bold",
    cursor: "pointer",
  },
  productListSide: { flex: 2, minWidth: 400 },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 15,
  },
  productCard: {
    backgroundColor: "white",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    overflow: "hidden",
  },
  productImageWrapper: { height: 150, backgroundColor: "#F3F4F6" },
  productImage: { width: "100%", height: "100%", objectFit: "cover" },
  productPrice: { color: "#EA580C", fontWeight: "bold", margin: "5px 0" },
  deleteBtn: {
    width: "100%",
    border: "1px solid #FEE2E2",
    color: "#EF4444",
    backgroundColor: "#FEF2F2",
    padding: 8,
    borderRadius: 8,
    cursor: "pointer",
  },
  actionBtnDisabled: (active) => ({
    backgroundColor: active ? "#E5E7EB" : "#F3F4F6",
    color: active ? "#1F2937" : "#9CA3AF",
    border: "none",
    padding: 8,
    borderRadius: 8,
    fontWeight: "bold",
    fontSize: 10,
    cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.6,
  }),
};

export default AdminPage;
