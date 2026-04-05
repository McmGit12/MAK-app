import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/services/api';

type LoginTab = 'email' | 'phone';

export default function LoginScreen() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [activeTab, setActiveTab] = useState<LoginTab>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoOtp, setDemoOtp] = useState('');

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user]);

  const handleEmailLogin = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await api.emailLogin(email);
      login(response);
      // If no display name, go to set-name screen
      if (!response.display_name) {
        router.replace('/set-name');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    setError('');
    
    try {
      const response = await api.guestLogin();
      login(response);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Guest login failed');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await api.requestOtp(phone);
      setDemoOtp(response.demo_otp || '');
      setShowOtpInput(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await api.verifyOtp(phone, otp);
      login(response);
      // If no display name, go to set-name screen
      if (!response.display_name) {
        router.replace('/set-name');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo/Brand Section */}
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="sparkles" size={48} color="#D4AF37" />
            </View>
            <Text style={styles.brandName}>MAK</Text>
            <Text style={styles.tagline}>Your Personalized Makeup Buddy</Text>
          </View>

          {/* Login Card */}
          <View style={styles.loginCard}>
            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'email' && styles.activeTab]}
                onPress={() => {
                  setActiveTab('email');
                  setError('');
                  setShowOtpInput(false);
                }}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={activeTab === 'email' ? '#D4AF37' : '#888'}
                />
                <Text style={[styles.tabText, activeTab === 'email' && styles.activeTabText]}>
                  Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'phone' && styles.activeTab]}
                onPress={() => {
                  setActiveTab('phone');
                  setError('');
                  setShowOtpInput(false);
                }}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={20}
                  color={activeTab === 'phone' ? '#D4AF37' : '#888'}
                />
                <Text style={[styles.tabText, activeTab === 'phone' && styles.activeTabText]}>
                  Phone
                </Text>
              </TouchableOpacity>
            </View>

            {/* Email Login */}
            {activeTab === 'email' && (
              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail" size={20} color="#D4AF37" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#666"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={handleEmailLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#0D0D0D" />
                  ) : (
                    <Text style={styles.loginButtonText}>Continue with Email</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Phone Login */}
            {activeTab === 'phone' && (
              <View style={styles.formContainer}>
                {!showOtpInput ? (
                  <>
                    <View style={styles.inputContainer}>
                      <Ionicons name="phone-portrait" size={20} color="#D4AF37" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter phone number"
                        placeholderTextColor="#666"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.loginButton}
                      onPress={handleRequestOtp}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#0D0D0D" />
                      ) : (
                        <Text style={styles.loginButtonText}>Send OTP</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Ionicons name="keypad" size={20} color="#D4AF37" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor="#666"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                    {demoOtp && (
                      <Text style={styles.demoOtpText}>Demo OTP: {demoOtp}</Text>
                    )}
                    <TouchableOpacity
                      style={styles.loginButton}
                      onPress={handleVerifyOtp}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#0D0D0D" />
                      ) : (
                        <Text style={styles.loginButtonText}>Verify OTP</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => {
                        setShowOtpInput(false);
                        setOtp('');
                        setDemoOtp('');
                      }}
                    >
                      <Text style={styles.backButtonText}>Change Number</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Guest Login Button */}
            <TouchableOpacity
              style={styles.guestButton}
              onPress={handleGuestLogin}
              disabled={guestLoading}
            >
              {guestLoading ? (
                <ActivityIndicator color="#D4AF37" />
              ) : (
                <>
                  <Ionicons name="person-outline" size={20} color="#D4AF37" />
                  <Text style={styles.guestButtonText}>Continue as Guest</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Privacy Note */}
          <Text style={styles.privacyNote}>
            We respect your privacy. No personal data is stored.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  brandName: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    color: '#D4AF37',
    marginTop: 8,
    letterSpacing: 1,
    textAlign: 'center',
  },
  loginCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#D4AF37',
  },
  formContainer: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#FFFFFF',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#D4AF37',
    fontSize: 14,
  },
  demoOtpText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  dividerText: {
    color: '#666',
    paddingHorizontal: 16,
    fontSize: 13,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'transparent',
    borderRadius: 12,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  guestButtonText: {
    color: '#D4AF37',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyNote: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
});
