import { io } from "socket.io-client";

// Gunakan fallback URL jika process.env tidak terbaca saat testing
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

const socket = io(SOCKET_URL, {
  transports: ["websocket"], // Langsung ke websocket agar lebih stabil
  withCredentials: true,
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

// Helper Debugging
socket.on("connect", () => {
  console.log(" Socket connected to:", SOCKET_URL);
});

socket.on("connect_error", (err) => {
  console.error(" Socket connection error:", err.message);
});

export default socket;
