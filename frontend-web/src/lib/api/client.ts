import axios from 'axios';
import { clearSession, getAccessToken } from '../auth/session';

const envApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const browserHost = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';

function formatHostForUrl(host: string): string {
  if (host.includes(':') && !host.startsWith('[')) {
    return `[${host}]`;
  }
  return host;
}

const fallbackApiBaseUrl = `http://${formatHostForUrl(browserHost)}:8000`;
const API_BASE_URL = envApiBaseUrl && envApiBaseUrl.length > 0 ? envApiBaseUrl : fallbackApiBaseUrl;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
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
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
