import axios from 'axios';

// Create configured Axios instance according to DPPL Table 2.1 & Section 3.6.6.e
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Kirim cookie sesi Laravel Sanctum
  withXSRFToken: true,   // Otomatis kirim header X-XSRF-TOKEN
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export default api;
