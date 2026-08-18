import React, { createContext, useContext, useState, useEffect } from 'react';
import { request } from '../utils/api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = (token: string, userData: User) => {
    localStorage.setItem('paytrack_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('paytrack_token');
    setUser(null);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('paytrack_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await request('/api/auth/me');
      setUser(data.user);
    } catch (err) {
      console.error('Session validation failed:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
