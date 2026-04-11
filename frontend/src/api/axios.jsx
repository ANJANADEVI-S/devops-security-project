/**
 * axios.jsx — JWT interceptor + auto-logout on 401
 */
import axios from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage on every request
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('vault_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 (token expired or invalid)
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vault_token');
      localStorage.removeItem('vault_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default instance;
