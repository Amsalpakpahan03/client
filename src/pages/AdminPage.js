import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import {
  Loader, Package, Boxes, Plus, Trash, Image as ImageIcon,
  ChefHat, TrendingUp, DollarSign, ClipboardList, Clock
} from "lucide-react";

/* ================= CONFIG ================= */
const REPLIT_URL = "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev";
const API_BASE = `${REPLIT_URL}/api`;

const socket = io(REPLIT_URL, { transports: ["websocket"] });

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: "", price: "", desc: "", category: "Makanan", imageFile: null,
  });

  /* ================= FETCH DATA ================= */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [orderRes, productRes] = await Promise.all([
        axios.get(`${API_BASE}/orders`),
        axios.get(`${API_BASE}/menu`)
      ]);
      setOrders(orderRes.data.reverse());
      setProducts(productRes.data);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Listener Real-time
    socket.on("admin_newOrder", (newOrder) => {
      setOrders(prev => [newOrder, ...prev]);
    });

    socket.on("admin_orderStatusUpdated", (updatedOrder) => {
      setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
    });

    return () => {
      socket.off("admin_newOrder");
      socket.off("admin_orderStatusUpdated");
    };
  }, [fetchData]);

  /* ================= HANDLERS ================= */
  const handleUpdateStatus = async (id, newStatus) => {
    // Optimistic Update
    setOrders(prev => prev.map(o => o._id === id ? { ...o, status: newStatus } : o));
    try {
      await axios.put(`${API_BASE}/orders/${id}/status`, { status: newStatus });
    } catch (err) {
      alert("Gagal update status");
      fetchData(); // Rollback
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.keys(newProduct).forEach(key => {
      if (key === "imageFile") {
        if (newProduct[key]) formData.append("image", newProduct[key]);
      } else if (key === "desc") {
        formData.append("description", newProduct[key]);
      } else {
        formData.append(key, newProduct[key]);
      }
    });

    try {
      await axios.post(`${API_BASE}/menu`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Produk berhasil ditambahkan!");
      setNewProduct({ name: "", price: "", desc: "", category: "Makanan", imageFile: null });
      setImagePreview(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Yakin ingin menghapus produk ini?")) return;
    try {
      await axios.delete(`${API_BASE}/menu/${id}`);
      setProducts(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      alert("Gagal menghapus");
    }
  };

  /* ================= CALCULATIONS ================= */
  const stats = useMemo(() => ({
    totalOrders: orders.length,
    revenue: orders.reduce((a, c) => a + (c.totalPrice || 0), 0),
    totalMenu: products.length
  }), [orders, products]);

  return (
    <div style={styles.page}>
      <AdminHeader activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div style={styles.container}>
        <StatsBar stats={stats} />

        {activeTab === "orders" ? (
          <OrderGrid 
            orders={orders} 
            isLoading={isLoading} 
            onUpdateStatus={handleUpdateStatus} 
          />
        ) : (
          <div style={styles.productFlex}>
            <ProductForm 
              newProduct={newProduct} 
              setNewProduct={setNewProduct}
              imagePreview={imagePreview}
              setImagePreview={setImagePreview}
              onSubmit={handleAddProduct}
            />
            <ProductList 
              products={products} 
              onDelete={handleDeleteProduct} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

/* ================= SUB-COMPONENTS ================= */

const AdminHeader = ({ activeTab, setActiveTab }) => (
  <div style={styles.header}>
    <div style={styles.headerContent}>
      <div style={styles.logoArea}>
        <div style={styles.logoIcon}><ChefHat color="white" size={24} /></div>
        <div>
          <h1 style={styles.logoText}>Admin Dash</h1>
          <div style={styles.liveIndicator}>
            <span style={styles.pulseDot}></span>
            <span style={styles.liveText}>Live System</span>
          </div>
        </div>
      </div>
      <div style={styles.tabWrapper}>
        <button onClick={() => setActiveTab("orders")} style={styles.tabBtn(activeTab === "orders")}>
          <ClipboardList size={16} /> Pesanan
        </button>
        <button onClick={() => setActiveTab("products")} style={styles.tabBtn(activeTab === "products")}>
          <Boxes size={16} /> Menu
        </button>
      </div>
    </div>
  </div>
);

const StatsBar = ({ stats }) => (
  <div style={styles.statsGrid}>
    <StatCard icon={<TrendingUp />} label="Total Pesanan" value={stats.totalOrders} color="#F97316" bg="#FFF7ED" />
    <StatCard icon={<DollarSign />} label="Estimasi Omzet" value={Rp ${stats.revenue.toLocaleString()}} color="#16A34A" bg="#F0FDF4" />
    <StatCard icon={<Package />} label="Total Menu" value={stats.totalMenu} color="#7C3AED" bg="#F5F3FF" />
  </div>
);

const StatCard = ({ icon, label, value, color, bg }) => (
  <div style={styles.statCard}>
    <div style={{ ...styles.statIcon, color, backgroundColor: bg }}>{icon}</div>
    <div>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
    </div>
  </div>
);

const OrderGrid = ({ orders, isLoading, onUpdateStatus }) => {
  if (isLoading && orders.length === 0) return <div style={styles.loaderCenter}><Loader className="animate-spin" /></div>;

  return (
    <div style={styles.ordersGrid}>
      {orders.map((o) => (
        <div key={o._id} style={styles.orderCard}>
          <div style={styles.orderCardContent}>
            <div style={{ flex: 1 }}>
              <div style={styles.orderHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={14} />
                  <span style={{ fontSize: 12, color: "#6B7280" }}>
                    {new Date(o.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <span style={styles.tableBadge}>Meja {o.tableNumber}</span>
                <StatusBadge status={o.status} />
              </div>
              <div style={styles.itemList}>
                {o.items.map((item, idx) => (
                  <div key={idx} style={styles.itemRow}>
                    <b style={{ color: "#5E4A3A" }}>{item.quantity}x</b> {item.name}
                  </div>
                ))}
              </div>
              <div style={styles.orderFooter}>
                <span style={styles.orderId}>#{o._id.slice(-6).toUpperCase()}</span>
                <span style={styles.orderTotal}>Rp {o.totalPrice?.toLocaleString()}</span>
              </div>
            </div>
            <div style={styles.orderActions}>
              <ActionButton label="Masak" active={o.status === "pending"} onClick={() => onUpdateStatus(o._id, "cooking")} />
              <ActionButton label="Antar" active={o.status === "cooking"} onClick={() => onUpdateStatus(o._id, "served")} />
              <ActionButton label="Lunas" active={o.status === "served"} onClick={() => onUpdateStatus(o._id, "paid")} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ProductForm = ({ newProduct, setNewProduct, imagePreview, setImagePreview, onSubmit }) => (
  <div style={styles.productFormSide}>
    <div style={styles.formCard}>
      <h3 style={styles.formTitle}><Plus size={20} /> Tambah Menu</h3>
      <form onSubmit={onSubmit} style={styles.form}>
        <label style={styles.label}>Nama Menu</label>
        <input style={styles.input} type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required />
        
        <div style={styles.inputRow}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Harga (Rp)</label>
            <input style={styles.input} type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Kategori</label>
            <select style={styles.input} value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}>
              {["Makanan", "Cemilan", "Minuman", "Paket"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <label style={styles.label}>Deskripsi</label>
        <textarea style={{ ...styles.input, height: 60 }} value={newProduct.desc} onChange={(e) => setNewProduct({ ...newProduct, desc: e.target.value })} />
        
        <label style={styles.fileLabel}>
          <input type="file" hidden accept="image/*" onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              setNewProduct({ ...newProduct, imageFile: file });
              setImagePreview(URL.createObjectURL(file));
            }
          }} />
          {imagePreview ? <img src={imagePreview} alt="Preview" style={styles.previewImg} /> : <div style={styles.uploadPlaceholder}><ImageIcon size={24} /> <span>Pilih Foto</span></div>}
        </label>
        <button type="submit" style={styles.submitBtn}>Simpan Menu</button>
      </form>
    </div>
  </div>
);

const ProductList = ({ products, onDelete }) => (
  <div style={styles.productListSide}>
    <div style={styles.productGrid}>
      {products.map((p) => (
        <div key={p._id} style={styles.productCard}>
          <img src={p.image_url || "/no-image.png"} style={styles.productImage} alt={p.name} />
          <div style={{ padding: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>{p.name}</h4>
            <p style={styles.productPrice}>Rp {p.price?.toLocaleString()}</p>
            <button style={styles.deleteBtn} onClick={() => onDelete(p._id)}><Trash size={14} /> Hapus</button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const stylesMap = {
    pending: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", label: "🔔 BARU" },
    cooking: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE", label: "COOKING" },
    served: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0", label: "SERVED" },
    paid: { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0", label: "PAID" },
  };
  const s = stylesMap[status] || { bg: "#F3F4F6", text: "#374151", label: status.toUpperCase() };
  return (
    <span style={{ ...styles.statusBadge, backgroundColor: s.bg, color: s.text, border: 1px solid ${s.border} }}>
      {s.label}
    </span>
  );
};

const ActionButton = ({ label, active, onClick }) => (
  <button
    disabled={!active}
    onClick={onClick}
    style={styles.actionBtnDisabled(active)}
  >
    {label}
  </button>
);

/* ================= STYLES ================= */
const styles = {
  page: { backgroundColor: "#F8F9FA", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#1F2937" },
  container: { maxWidth: 1200, margin: "0 auto", padding: "0 20px 40px" },
  header: { backgroundColor: "white", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 10, padding: "12px 0" },
  headerContent: { maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  logoArea: { display: "flex", alignItems: "center", gap: 12 },
  logoIcon: { backgroundColor: "#5E4A3A", padding: 8, borderRadius: 10 },
  logoText: { margin: 0, fontSize: 20, fontWeight: "800", color: "#5E4A3A", letterSpacing: "-0.5px" },
  liveIndicator: { display: "flex", alignItems: "center", gap: 5, marginTop: -2 },
  pulseDot: { width: 6, height: 6, backgroundColor: "#22C55E", borderRadius: "50%", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" },
  liveText: { fontSize: 9, color: "#9CA3AF", fontWeight: "bold" },
  tabWrapper: { display: "flex", backgroundColor: "#F3F4F6", padding: 4, borderRadius: 12 },
  tabBtn: (active) => ({
    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: "600", fontSize: 13,
    backgroundColor: active ? "white" : "transparent", color: active ? "#5E4A3A" : "#6B7280",
    boxShadow: active ? "0 4px 6px -1px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s"
  }),
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, margin: "24px 0" },
  statCard: { backgroundColor: "white", padding: 20, borderRadius: 16, border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 16 },
  statIcon: { padding: 12, borderRadius: 12 },
  statLabel: { margin: 0, fontSize: 12, color: "#6B7280", fontWeight: "600" },
  statValue: { margin: 0, fontSize: 22, fontWeight: "800", color: "#111827" },
  ordersGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20 },
  orderCard: { backgroundColor: "white", borderRadius: 16, border: "1px solid #E5E7EB", transition: "transform 0.2s", ":hover": { transform: "translateY(-2px)" } },
  orderCardContent: { padding: 20, display: "flex", gap: 20 },
  orderHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  tableBadge: { backgroundColor: "#5E4A3A", color: "white", padding: "4px 10px", borderRadius: 6, fontWeight: "bold", fontSize: 12 },
  statusBadge: { fontSize: 10, fontWeight: "800", padding: "4px 10px", borderRadius: 20 },
  itemList: { marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #F3F4F6" },
  itemRow: { fontSize: 14, color: "#4B5563", marginBottom: 6 },
  orderFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  orderId: { fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" },
  orderTotal: { fontSize: 18, fontWeight: "800", color: "#EA580C" },
  orderActions: { display: "flex", flexDirection: "column", gap: 6, minWidth: 90 },
  productFlex: { display: "flex", gap: 24, flexWrap: "wrap" },
  productFormSide: { flex: "1 1 320px" },
  formCard: { backgroundColor: "white", padding: 24, borderRadius: 16, border: "1px solid #E5E7EB", position: "sticky", top: 100 },
  formTitle: { margin: "0 0 20px 0", color: "#5E4A3A", display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: "800" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: -8 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #D1D5DB", fontSize: 14, outline: "none", ":focus": { borderColor: "#5E4A3A" } },
  inputRow: { display: "flex", gap: 12 },
  fileLabel: { border: "2px dashed #E5E7EB", padding: 12, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minHeight: 80, justifyContent: "center" },
  previewImg: { width: "100%", height: 80, objectFit: "cover", borderRadius: 8 },
  uploadPlaceholder: { display: "flex", flexDirection: "column", alignItems: "center", color: "#9CA3AF", gap: 4, fontSize: 12 },
  submitBtn: { backgroundColor: "#5E4A3A", color: "white", padding: "12px", borderRadius: 10, border: "none", fontWeight: "800", cursor: "pointer", marginTop: 10 },
  productListSide: { flex: "2 1 500px" },
  productGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 },
  productCard: { backgroundColor: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" },
  productImage: { width: "100%", height: 130, objectFit: "cover", backgroundColor: "#F3F4F6" },
  productPrice: { color: "#EA580C", fontWeight: "800", margin: "4px 0 10px", fontSize: 14 },
  deleteBtn: { width: "100%", border: "none", color: "#EF4444", backgroundColor: "#FEF2F2", padding: "8px", borderRadius: 8, cursor: "pointer", fontWeight: "700", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 },
  loaderCenter: { display: "flex", justifyContent: "center", padding: "100px 0", color: "#5E4A3A" },
  actionBtnDisabled: (active) => ({
    backgroundColor: active ? "#5E4A3A" : "#F3F4F6",
    color: active ? "white" : "#9CA3AF",
    border: "none", padding: "8px", borderRadius: 8, fontWeight: "700", fontSize: 11, cursor: active ? "pointer" : "not-allowed", transition: "0.2s"
  }),
};

export default AdminPage;
