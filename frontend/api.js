import axios from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const fetchCaptcha = async () => {
  const response = await apiClient.get('/captcha');
  return response.data;
};

export const syncAttendance = async (credentials) => {
  const response = await apiClient.post('/sync', credentials);
  return response.data;
};