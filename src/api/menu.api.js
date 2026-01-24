import api from "./axios";

export const MenuAPI = {
  getAll() {
    return api.get("/menu");
  },
};
