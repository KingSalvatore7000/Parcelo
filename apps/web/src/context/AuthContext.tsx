import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: 'RESIDENT' | 'GUARD' | 'ADMIN';
  societyId: string;
  societyName: string;
  flatId?: string | null;
  flat?: {
    id: string;
    tower: string;
    number: string;
    label: string;
  } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithOtp: (phone: string, otp: string) => Promise<User>;
  quickLogin: (phone: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('parcelo_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.auth.getMe();
        setUser(res.data);
      } catch (err) {
        console.warn('Session expired or invalid token:', err);
        logout();
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const loginWithOtp = async (phone: string, otp: string): Promise<User> => {
    const res = await api.auth.verifyOtp(phone, otp);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('parcelo_token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const quickLogin = async (phone: string): Promise<User> => {
    // Demo only: works when the API runs in development and returns the OTP
    const reqRes = await api.auth.requestOtp(phone);
    const otp = reqRes.devOtp;
    if (!otp) {
      throw new Error('Quick login needs the API running in development mode.');
    }
    // 2. Verify OTP
    return loginWithOtp(phone, otp);
  };

  const logout = () => {
    localStorage.removeItem('parcelo_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        loginWithOtp,
        quickLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
