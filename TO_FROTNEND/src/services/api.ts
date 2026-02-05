// ============================================================
// src/services/api.ts - PRODUCTION API CLIENT
// ============================================================
import axios, { 
  type AxiosInstance, 
  AxiosError, 
  type InternalAxiosRequestConfig,
  type AxiosResponse 
} from 'axios';
import router from '../router';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';
const API_URL = `${API_BASE_URL}/api/${API_VERSION}`;

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    (config as any).metadata = { startTime: new Date().getTime() };
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.DEV && (response.config as any).metadata) {
      const duration = new Date().getTime() - (response.config as any).metadata.startTime;
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
    }
    
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(token => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        })
        .catch(err => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshResponse = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const { accessToken } = refreshResponse.data.data;

      localStorage.setItem('access_token', accessToken);

      if (apiClient.defaults.headers.common) {
        apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      }

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }

      processQueue(null, accessToken);

      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as AxiosError, null);
      
      localStorage.removeItem('access_token');
      
      router.push('/login');
      
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export const handleApiError = (error: AxiosError): string => {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data as any;

    switch (status) {
      case 400:
        return data?.message || 'Noto\'g\'ri ma\'lumot yuborildi';
      case 401:
        return 'Avtorizatsiya xatosi. Qayta kiring';
      case 403:
        return 'Sizda bu amalni bajarish uchun ruxsat yo\'q';
      case 404:
        return data?.message || 'Ma\'lumot topilmadi';
      case 409:
        return data?.message || 'Bunday ma\'lumot allaqachon mavjud';
      case 422:
        return data?.message || 'Ma\'lumotlarni tekshiring';
      case 429:
        return 'Juda ko\'p so\'rov. Biroz kuting';
      case 500:
        return 'Server xatosi. Keyinroq urinib ko\'ring';
      default:
        return data?.message || 'Xatolik yuz berdi';
    }
  } else if (error.request) {
    return 'Serverga ulanib bo\'lmadi. Internetni tekshiring';
  } else {
    return error.message || 'Kutilmagan xatolik';
  }
};

export default apiClient;

export const isApiError = (error: any): error is AxiosError => {
  return axios.isAxiosError(error);
};

export const getErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    return handleApiError(error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Kutilmagan xatolik';
};