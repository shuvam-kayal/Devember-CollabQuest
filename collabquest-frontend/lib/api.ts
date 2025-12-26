import axios from "axios";
import Cookies from "js-cookie";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000", // Update with your actual URL
});

// REQUEST INTERCEPTOR: Attaches the token to every request automatically
api.interceptors.request.use(
  (config) => {
    // 1. Get the token from cookies
    const token = Cookies.get("token");
    
    // 2. If token exists, add it to the Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;