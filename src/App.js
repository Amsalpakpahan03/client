import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import OrderMenu from "./pages/OrderMenu";
import Kitchen from "./pages/Kitchen";
import AdminPage from "./pages/AdminPage"; // ✅ GANTI INI
import './index.css'; // Pastikan file ini berisi @tailwind base; @tailwind components; @tailwind utilities;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/order" element={<OrderMenu />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/admin" element={<AdminPage />} /> {/* ✅ FIX */}
        <Route
          path="/"
          element={
            <h1 style={{ textAlign: "center", marginTop: "50px" }}>
              Sistem Warung Ndeso
              <br />
              <small>Scan QR untuk memesan</small>
            </h1>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
