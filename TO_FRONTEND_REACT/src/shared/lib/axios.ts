import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../features/auth/model/auth.store';

// ── Yagona base URL manbai ─────────────────────────────────────
const BASE_URL =
  (import.meta as any).env?.VITE_API_URL ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  'http://localhost:4001/api/v1';

// ── Asosiy instance ────────────────────────────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Refresh uchun alohida instance (interceptor loop oldini oladi)
const refreshApi: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: token qo'shish ───────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token =
      useAuthStore.getState().accessToken ??
      localStorage.getItem('accessToken');

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: 401 → refresh → retry ───────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (originalRequest.headers) {
          (originalRequest.headers as any).Authorization = `Bearer ${token}`;
        }
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await refreshApi.post<{ accessToken: string }>('/auth/refresh');
      const newToken = data.accessToken;

      useAuthStore.getState().setAccessToken(newToken);
      localStorage.setItem('accessToken', newToken);

      processQueue(null, newToken);

      if (originalRequest.headers) {
        (originalRequest.headers as any).Authorization = `Bearer ${newToken}`;
      }
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useAuthStore.getState().logout();
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;