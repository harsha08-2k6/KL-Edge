import axios from 'axios';

const isProduction = import.meta.env.PROD;

export const api = axios.create({
  // In production, point to the Vercel routed backend.
  // In local dev, point to your local FastAPI server.
  baseURL: isProduction ? '/_/backend' : 'http://localhost:8000',
});

export default api;