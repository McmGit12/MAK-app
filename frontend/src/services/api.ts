import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 60000, // 60 seconds for AI analysis
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
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
  emailLogin: async (email: string) => {
    const response = await apiClient.post('/auth/email-login', { email });
    return response.data;
  },

  guestLogin: async () => {
    const response = await apiClient.post('/auth/guest-login');
    return response.data;
  },

  updateDisplayName: async (userId: string, displayName: string) => {
    const response = await apiClient.put('/auth/update-name', {
      user_id: userId,
      display_name: displayName,
    });
    return response.data;
  },

  requestOtp: async (phone: string) => {
    const response = await apiClient.post('/auth/request-otp', { phone });
    return response.data;
  },

  verifyOtp: async (phone: string, otp: string) => {
    const response = await apiClient.post('/auth/verify-otp', { phone, otp });
    return response.data;
  },

  // Skin analysis endpoints
  analyzeSkin: async (imageBase64: string, userId: string) => {
    const response = await apiClient.post('/analyze-skin', {
      image_base64: imageBase64,
      user_id: userId,
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
};
