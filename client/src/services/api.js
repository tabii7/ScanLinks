import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 300000, // 5 minutes timeout for long-running operations like sentiment analysis
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Ensure response always has data property (like previous_code)
    if (!response.data) {
      console.warn('⚠️ Response has no data property, setting default');
      response.data = {};
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    // Ensure error response has data structure
    if (error.response && !error.response.data) {
      error.response.data = { message: error.message || 'An error occurred' };
    }
    return Promise.reject(error);
  }
);

export default api;
