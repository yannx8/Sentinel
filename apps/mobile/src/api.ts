import { ApiClient } from '@sentinel/shared';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient = new ApiClient(BASE_URL);

let currentToken: string | null = null;
apiClient.setTokenResolver(() => currentToken || null);

export const setAuthToken = (token: string | null) => {
  currentToken = token;
};
