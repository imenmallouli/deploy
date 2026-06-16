import axios from 'axios';
import { clearSession, getAccessToken } from '../auth/session';

const envApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const fallbackApiBaseUrl = 'http://127.0.0.1:8000';
const API_BASE_URL = envApiBaseUrl && envApiBaseUrl.length > 0 ? envApiBaseUrl : fallbackApiBaseUrl;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error?.response) {
      error.message = 'Impossible de joindre le backend. Verifiez que Docker Desktop et l\'API backend sont demarres.';
      return Promise.reject(error);
    }

    if (error?.response?.status === 401 || error?.response?.status === 403) {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
