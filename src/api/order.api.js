import api from "./axios";

export const OrderAPI = {
  getAll() {
    return api.get("/orders");
  },

  getById(id) {
    return api.get(`/orders/${id}`);
  },

  create(payload) {
    return api.post("/orders", payload);
  },

  updateStatus(id, status) {
    return api.put(`/orders/${id}/status`, { status });
  },
};
