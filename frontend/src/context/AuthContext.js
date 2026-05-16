import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Axios instance
const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('helpdesk_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setToken = (token) => localStorage.setItem('helpdesk_token', token);
  const clearToken = () => localStorage.removeItem('helpdesk_token');

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('helpdesk_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get('/me');
      setUser(res.data);
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, username, full_name, password) => {
    const res = await api.post('/auth/register', { email, username, full_name, password });
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
};

export { api };
