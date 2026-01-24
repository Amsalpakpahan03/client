import { useEffect, useState } from "react";
import { MenuAPI } from "../api/menu.api";

export function useMenu() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const { data } = await MenuAPI.getAll();
        setMenuItems(data);
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
  }, []);

  return { menuItems, loading };
}
