import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, loadAuthToken, setAuthToken as apiSetAuthToken } from '../api';
import * as SecureStore from 'expo-secure-store';

import { User, UserRole } from '@sentinel/shared';

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        await loadAuthToken();
        const storedUser = await SecureStore.getItemAsync('auth_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        // Restoring token failed
        console.error('Failed to load session', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const login = async (token: string, userData: User) => {
    await apiSetAuthToken(token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    apiClient.setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
