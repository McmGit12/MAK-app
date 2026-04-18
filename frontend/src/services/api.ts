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
    const response = await apiClient.post('/travel-style', { country, month, occasion, user_id: userId });
    return response.data;
  },

  // Chatbot
  chatWithMak: async (message: string, sessionId?: string) => {
    const response = await apiClient.post('/chat', { message, session_id: sessionId });
    return response.data;
  },
};
