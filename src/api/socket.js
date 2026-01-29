// api/socket.js
import { io } from "socket.io-client";

const SOCKET_URL = "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: true,
  reconnectionAttempts: 5,
});

export default socket;
