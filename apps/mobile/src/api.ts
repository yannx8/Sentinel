import { ApiClient } from '@sentinel/shared';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient = new ApiClient(BASE_URL);

export const setAuthToken = async (token: string) => {
  apiClient.setToken(token);
  await SecureStore.setItemAsync('auth_token', token);
};

export const loadAuthToken = async () => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    apiClient.setToken(token);
  }
};

