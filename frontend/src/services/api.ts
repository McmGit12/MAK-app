import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 60000, // 60 seconds default
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// AUTO-RETRY INTERCEPTOR
// Retries on transient errors (network/502/503/504) up to 2 times
// with exponential backoff. Does NOT retry on 4xx (user errors).
//
// IMPORTANT: Requests can opt OUT of retry by passing { _skipRetry: true }
// in the axios config. We use this for AI endpoints (/analyze-skin,
// /travel-style) because the BACKEND already has its own internal retry
// (18s + 25s). Stacking frontend retries on top caused the symptom
// "first scan shows 'taking too long'" — the two retry windows compounded
// and exceeded the axios timeout even when the backend would have responded.
// ============================================================
type RetryConfig = AxiosRequestConfig & { _retryCount?: number; _skipRetry?: boolean };

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 2500]; // 1s, 2.5s
const RETRY_STATUS_CODES = [502, 503, 504];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig;
    if (!config) return Promise.reject(error);

    // Opt-out flag — honored for AI endpoints that already retry server-side
    if (config._skipRetry) return Promise.reject(error);

    const retryCount = config._retryCount || 0;

    const status = error.response?.status;
    const isNetworkError = !error.response && error.code !== 'ERR_CANCELED';
    const isRetryableStatus = status !== undefined && RETRY_STATUS_CODES.includes(status);
    const shouldRetry = (isNetworkError || isRetryableStatus) && retryCount < MAX_RETRIES;

    if (shouldRetry) {
      config._retryCount = retryCount + 1;
      const delay = RETRY_DELAYS[retryCount] || 2500;
      // eslint-disable-next-line no-console
      console.log(`[api] Retrying request (${config._retryCount}/${MAX_RETRIES}) after ${delay}ms - status=${status ?? 'network'}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(config);
    }

    return Promise.reject(error);
  }
);

export const api = {
  // Warmup — called on app launch to kill cold-start latency
  warmup: async () => {
    try {
      const response = await apiClient.get('/warmup', { timeout: 10000 });
      return response.data;
    } catch (e) {
      // Non-fatal — app continues even if warmup fails
      // eslint-disable-next-line no-console
      console.warn('[api] Warmup failed (non-fatal):', (e as Error).message);
      return null;
    }
  },

  healthCheck: async () => {
    const response = await apiClient.get('/health', { timeout: 5000 });
    return response.data;
  },

  // App Install Tracking
  registerInstall: async (deviceId: string, platform: string = 'android', appVersion: string = '1.0.0') => {
    const response = await apiClient.post(`/app/register-install?device_id=${deviceId}&platform=${platform}&app_version=${appVersion}`);
    return response.data;
  },

  getInstallStats: async () => {
    const response = await apiClient.get('/app/install-stats');
    return response.data;
  },

  // Auth endpoints
  checkEmail: async (email: string) => {
    const response = await apiClient.post('/auth/check-email', { email });
    return response.data;
  },

  register: async (email: string, name: string, password: string) => {
    const response = await apiClient.post('/auth/register', { email, name, password });
    return response.data;
  },

  passwordLogin: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/password-login', { email, password });
    return response.data;
  },

  updateDisplayName: async (userId: string, displayName: string) => {
    const response = await apiClient.put('/auth/update-name', {
      user_id: userId,
      display_name: displayName,
    });
    return response.data;
  },

  // Skin analysis endpoints
  analyzeSkin: async (imageBase64: string, userId: string, mode: string = 'skin_care') => {
    const response = await apiClient.post('/analyze-skin', {
      image_base64: imageBase64,
      user_id: userId,
      mode: mode,
    });
    return response.data;
  },

  getUserAnalyses: async (userId: string) => {
    const response = await apiClient.get(`/analyses/${userId}`);
    return response.data;
  },

  getAnalysis: async (analysisId: string) => {
    const response = await apiClient.get(`/analysis/${analysisId}`);
    return response.data;
  },

  // Curated recommendations
  getCuratedRecommendations: async (skinType?: string, skinTone?: string, category?: string) => {
    const params = new URLSearchParams();
    if (skinType) params.append('skin_type', skinType);
    if (skinTone) params.append('skin_tone', skinTone);
    if (category) params.append('category', category);
    
    const response = await apiClient.get(`/curated-recommendations?${params.toString()}`);
    return response.data;
  },

  // Feedback
  submitFeedback: async (data: {
    user_id: string;
    rating: number;
    category: string;
    comment?: string;
  }) => {
    const response = await apiClient.post('/feedback', data);
    return response.data;
  },

  getUserFeedback: async (userId: string) => {
    const response = await apiClient.get(`/feedback/${userId}`);
    return response.data;
  },

  // Travel Style
  getTravelStyle: async (country: string, month: string, occasion: string, userId?: string) => {
    // 90s timeout + no frontend retry — backend handles retry internally.
    const response = await apiClient.post(
      '/travel-style',
      { country, month, occasion, user_id: userId },
      { timeout: 90000, _skipRetry: true } as any,
    );
    return response.data;
  },

  // ============================================================
  // LOCATION DATA — backend-served (saves ~7-8MB from APK bundle vs
  // bundling country-state-city library directly). Frontend caches
  // results in memory, so each unique fetch only happens once per session.
  // ============================================================
  getCountries: async (): Promise<Array<{ name: string; isoCode: string; flag: string }>> => {
    const response = await apiClient.get('/locations/countries', { timeout: 15000 });
    return response.data;
  },
  getStates: async (countryCode: string): Promise<Array<{ name: string; isoCode: string }>> => {
    const response = await apiClient.get(`/locations/states/${countryCode}`, { timeout: 10000 });
    return response.data;
  },
  getCities: async (countryCode: string, stateCode: string): Promise<Array<{ name: string }>> => {
    const response = await apiClient.get(`/locations/cities/${countryCode}/${stateCode}`, { timeout: 10000 });
    return response.data;
  },

  // Notify-me waitlist signup for "Coming Soon" features
  notifySignup: async (email: string, userId?: string, featureHint?: string): Promise<{ status: string; message: string; already_subscribed: boolean }> => {
    const response = await apiClient.post('/notify-signup', { email, user_id: userId, feature_hint: featureHint }, { timeout: 15000 });
    return response.data;
  },

  // Chatbot
  chatWithMak: async (message: string, sessionId?: string) => {
    const response = await apiClient.post('/chat', { message, session_id: sessionId });
    return response.data;
  },

  // Change Password
  changePassword: async (userId: string, currentPassword: string, newPassword: string) => {
    const response = await apiClient.post('/auth/change-password', { user_id: userId, current_password: currentPassword, new_password: newPassword });
    return response.data;
  },

  // Get Profile
  getProfile: async (userId: string) => {
    const response = await apiClient.get(`/auth/profile/${userId}`);
    return response.data;
  },
};

