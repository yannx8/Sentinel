import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient, setAuthToken } from '../api';

type UserData = {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
};

interface AuthContextType {
  user: UserData | null;
  orgRole: string | null;
  isLoaded: boolean;
  signIn: (token: string, userData: UserData) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await SecureStore.getItemAsync('auth_token');
        if (token) {
          setAuthToken(token);
          // Fetch user data
          const me = await apiClient.get<UserData>('/auth/me');
          setUser(me);
          setOrgRole(me.role);
        }
      } catch (err) {
        console.error('Failed to load token or user', err);
        await SecureStore.deleteItemAsync('auth_token');
        setAuthToken(null);
      } finally {
        setIsLoaded(true);
      }
    };
    loadToken();
  }, []);

  const signIn = async (token: string, userData: UserData) => {
    await SecureStore.setItemAsync('auth_token', token);
    setAuthToken(token);
    setUser(userData);
    setOrgRole(userData.role);
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    setAuthToken(null);
    setUser(null);
    setOrgRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, orgRole, isLoaded, signIn, signOut }}>
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
