import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, session, SessionPayload } from '../services/api';
import { DEMO_PASSWORD } from '../config';

export type User = SessionPayload['user'];

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>;
  quickLogin: (phone: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // The session is the refresh token: the access token is renewed from it as it expires
  const [token, setToken] = useState<string | null>(() => session.refresh() ?? session.access());
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

  const startSession = ({ token: access, refreshToken, user: userData }: SessionPayload): User => {
    session.save(access, refreshToken);
    setToken(refreshToken);
    setUser(userData);
    return userData;
  };

  const login = async (phone: string, password: string): Promise<User> => {
    const res = await api.auth.login(phone, password);
    // Switching accounts (demo "Switch view"): end the previous session on the server
    const previous = session.refresh();
    if (previous) api.auth.logout(previous).catch(() => {});
    return startSession(res.data);
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<User> => {
    const res = await api.auth.changePassword(currentPassword, newPassword);
    return startSession(res.data);
  };

  // Demo profiles only: the seeded demo accounts share one password
  const quickLogin = (phone: string) => login(phone, DEMO_PASSWORD);

  const logout = () => {
    const refreshToken = session.refresh();
    if (refreshToken) api.auth.logout(refreshToken).catch(() => {});
    session.clear();
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
        login,
        changePassword,
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
