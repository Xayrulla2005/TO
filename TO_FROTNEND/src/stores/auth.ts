import { defineStore } from "pinia";
import axios from "axios";

type UserRole = "ADMIN" | "SALER";

interface User {
  id: string;
  username: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === "ADMIN",
  },

  actions: {
  async login(username: string, password: string) {
    const res = await axios.post("/api/v1/auth/login", { username, password });
    const data = res.data?.data ?? res.data;

    this.token = data.accessToken;
    this.user = data.user;
  },

  async fetchProfile() {
    const res = await axios.get("/api/v1/auth/me");
    const data = res.data?.data ?? res.data;

    this.user = data;
  },

  logout() {
    this.user = null;
    this.token = null;
  },
},
  
});

