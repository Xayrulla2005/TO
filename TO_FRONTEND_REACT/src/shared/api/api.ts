// src/shared/api/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Tokenni topish - turli nomlarda bo'lishi mumkin
    const token = 
      localStorage.getItem('accessToken') || 
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('token');
    
    if (token) {
      // Backend Bearer so'rasa
      config.headers.Authorization = `Bearer ${token}`;
      
      // Yoki oddiy token so'rasa
      // config.headers.Authorization = token;
      
      // Yoki boshqa header so'rasa
      // config.headers['x-auth-token'] = token;
    }
    
    console.log('Request Headers:', config.headers);
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
    });
    
    // Faqat console'ga chiqarish, toast ko'rsatmaslik
    if (error.response?.status === 401) {
      console.error('Unauthorized - Token invalid or expired');
    }
    
    return Promise.reject(error);
  }
);

export default api;