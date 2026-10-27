import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('pos_token') || null;
  });

  const [loading, setLoading] = useState(false);

  // Login with Username and Password
  const loginWithPassword = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.login({ username, password });
      if (res.success && res.user) {
        setUser(res.user);
        setToken(res.token);
        localStorage.setItem('pos_user', JSON.stringify(res.user));
        localStorage.setItem('pos_token', res.token);
        return { success: true, user: res.user };
      }
      throw new Error(res.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Login with 4-Digit Quick PIN (Numpad)
  const loginWithPin = async (pin) => {
    setLoading(true);
    try {
      const res = await api.login({ pin });
      if (res.success && res.user) {
        setUser(res.user);
        setToken(res.token);
        localStorage.setItem('pos_user', JSON.stringify(res.user));
        localStorage.setItem('pos_token', res.token);
        return { success: true, user: res.user };
      }
      throw new Error(res.error || 'Invalid PIN');
    } finally {
      setLoading(false);
    }
  };

  // Logout / Lock Terminal
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_token');
  };

  const setAuthSession = (newUser, newToken) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('pos_user', JSON.stringify(newUser));
    localStorage.setItem('pos_token', newToken);
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        loading,
        loginWithPassword,
        loginWithPin,
        setAuthSession,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
