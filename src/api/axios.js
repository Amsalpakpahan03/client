import axios from "axios";

// const api = axios.create({
//   baseURL: "http://localhost:5000/api",
//   timeout: 10000,
// });

const api = axios.create({
  baseURL: "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev/api",
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("order_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

