import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_URL =
  "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev/api";

export const useOrder = (tableNumber) => {
  const [activeOrder, setActiveOrder] = useState(null);

  /* ================= CREATE ORDER ================= */
  const createOrder = async (payload) => {
    const token = localStorage.getItem("order_token");

    const res = await axios.post(
      `${API_URL}/orders`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setActiveOrder(res.data);
    localStorage.setItem("activeOrderId", res.data._id);
  };

  /* ================= RESTORE ORDER ================= */
  useEffect(() => {
    if (!tableNumber) return;

    const orderId = localStorage.getItem("activeOrderId");
    if (!orderId) return;

    let cancelled = false;

    axios
      .get(`${API_URL}/orders/${orderId}`)
      .then((res) => {
        if (cancelled) return;

        if (res.data && res.data.status !== "paid") {
          setActiveOrder(res.data);
        } else {
          localStorage.removeItem("activeOrderId");
          setActiveOrder(null);
        }
      })
      .catch(() => {
        localStorage.removeItem("activeOrderId");
        setActiveOrder(null);
      });

    return () => {
      cancelled = true;
    };
  }, [tableNumber]);

  /* ================= SOCKET UPDATE (FIXED) ================= */
  const updateOrderFromSocket = useCallback((updatedOrder) => {
    setActiveOrder((current) => {
      // 🔥 BELUM ADA ORDER → TERIMA DATA SOCKET
      if (!current) {
        if (updatedOrder.status === "paid") return null;

        localStorage.setItem(
          "activeOrderId",
          updatedOrder._id
        );
        return updatedOrder;
      }

      // 🔒 BUKAN ORDER KITA → ABAIKAN
     if (String(current._id) !== String(updatedOrder._id)) return current;
      

      // ✅ ORDER SELESAI
      if (updatedOrder.status === "paid") {
        localStorage.removeItem("activeOrderId");
        return null;
      }

      // 🔁 UPDATE STATE
      return {
        ...current,
        ...updatedOrder,
      };
    });
  }, []);

  return {
    activeOrder,
    createOrder,
    updateOrderFromSocket,
  };
};
