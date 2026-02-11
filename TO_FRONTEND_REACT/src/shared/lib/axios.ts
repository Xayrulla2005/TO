import axios from 'axios';
import { ENV } from '../config/env';
import { useAuthStore } from '../../features/auth/model/auth.store';

export const api = axios.create({
  baseURL: ENV.API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// refresh uchun interceptor ishlamaydigan instance
const refreshApi = axios.create({
  baseURL: ENV.API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await refreshApi.post('/auth/refresh');
        useAuthStore.getState().setAccessToken(data.accessToken);

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
