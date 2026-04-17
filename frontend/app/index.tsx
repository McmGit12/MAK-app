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
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/services/api';

type LoginTab = 'email' | 'phone';

export default function LoginScreen() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { colors } = useTheme();
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
    if (!email.trim()) { setError('Please enter your email'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError('Please enter a valid email'); return; }
    setLoading(true);
    setError('');
    try {
      const response = await api.emailLogin(email);
      login(response);
      if (!response.display_name) { router.replace('/set-name'); } else { router.replace('/(tabs)'); }
    } catch (err: any) { setError(err.message || 'Login failed'); } finally { setLoading(false); }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    setError('');
    try {
      const response = await api.guestLogin();
      login(response);
      router.replace('/(tabs)');
    } catch (err: any) { setError(err.message || 'Guest login failed'); } finally { setGuestLoading(false); }
  };

  const handleRequestOtp = async () => {
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    setLoading(true);
    setError('');
    try {
      const response = await api.requestOtp(phone);
      setDemoOtp(response.demo_otp || '');
      setShowOtpInput(true);
    } catch (err: any) { setError(err.message || 'Failed to send OTP'); } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) { setError('Please enter a valid 6-digit OTP'); return; }
    setLoading(true);
    setError('');
    try {
      const response = await api.verifyOtp(phone, otp);
      login(response);
      if (!response.display_name) { router.replace('/set-name'); } else { router.replace('/(tabs)'); }
    } catch (err: any) { setError(err.message || 'Invalid OTP'); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Logo/Brand */}
          <View style={styles.brandSection}>
            <View style={[styles.logoContainer, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
              <Ionicons name="sparkles" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.brandName, { color: colors.text }]}>MAK</Text>
            <Text style={[styles.tagline, { color: colors.primary }]}>Your Personalized Makeup Buddy</Text>
          </View>

          {/* Login Card */}
          <View style={[styles.loginCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: colors.surfaceVariant }]}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'email' && { backgroundColor: colors.primaryLight }]}
                onPress={() => { setActiveTab('email'); setError(''); setShowOtpInput(false); }}
              >
                <Ionicons name="mail-outline" size={20} color={activeTab === 'email' ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabText, { color: activeTab === 'email' ? colors.primary : colors.textTertiary }]}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'phone' && { backgroundColor: colors.primaryLight }]}
                onPress={() => { setActiveTab('phone'); setError(''); setShowOtpInput(false); }}
              >
                <Ionicons name="phone-portrait-outline" size={20} color={activeTab === 'phone' ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabText, { color: activeTab === 'phone' ? colors.primary : colors.textTertiary }]}>Phone</Text>
              </TouchableOpacity>
            </View>

            {/* Email Login */}
            {activeTab === 'email' && (
              <View style={styles.formContainer}>
                <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="mail" size={20} color={colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Enter your email"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <TouchableOpacity style={[styles.loginButton, { backgroundColor: colors.primary }]} onPress={handleEmailLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.loginButtonText, { color: colors.buttonText }]}>Continue with Email</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Phone Login */}
            {activeTab === 'phone' && (
              <View style={styles.formContainer}>
                {!showOtpInput ? (
                  <>
                    <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <Ionicons name="phone-portrait" size={20} color={colors.primary} style={styles.inputIcon} />
                      <TextInput style={[styles.input, { color: colors.text }]} placeholder="Enter phone number" placeholderTextColor={colors.textTertiary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                    </View>
                    <TouchableOpacity style={[styles.loginButton, { backgroundColor: colors.primary }]} onPress={handleRequestOtp} disabled={loading}>
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.loginButtonText, { color: colors.buttonText }]}>Send OTP</Text>}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <Ionicons name="keypad" size={20} color={colors.primary} style={styles.inputIcon} />
                      <TextInput style={[styles.input, { color: colors.text }]} placeholder="Enter 6-digit OTP" placeholderTextColor={colors.textTertiary} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                    </View>
                    {demoOtp ? <Text style={[styles.demoOtpText, { color: colors.textSecondary }]}>Demo OTP: {demoOtp}</Text> : null}
                    <TouchableOpacity style={[styles.loginButton, { backgroundColor: colors.primary }]} onPress={handleVerifyOtp} disabled={loading}>
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.loginButtonText, { color: colors.buttonText }]}>Verify OTP</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.backButton} onPress={() => { setShowOtpInput(false); setOtp(''); setDemoOtp(''); }}>
                      <Text style={[styles.backButtonText, { color: colors.primary }]}>Change Number</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Guest */}
            <TouchableOpacity style={[styles.guestButton, { borderColor: colors.border }]} onPress={handleGuestLogin} disabled={guestLoading}>
              {guestLoading ? <ActivityIndicator color={colors.primary} /> : (
                <>
                  <Ionicons name="person-outline" size={20} color={colors.primary} />
                  <Text style={[styles.guestButtonText, { color: colors.primary }]}>Continue as Guest</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.privacyNote, { color: colors.textTertiary }]}>We respect your privacy. No personal data is stored.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  brandSection: { alignItems: 'center', marginBottom: 40 },
  logoContainer: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2 },
  brandName: { fontSize: 42, fontWeight: '700', letterSpacing: 4 },
  tagline: { fontSize: 13, marginTop: 8, letterSpacing: 1, textAlign: 'center' },
  loginCard: { borderRadius: 24, padding: 24, borderWidth: 1 },
  tabContainer: { flexDirection: 'row', marginBottom: 24, borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  tabText: { fontSize: 14, fontWeight: '600' },
  formContainer: { gap: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 52, fontSize: 16 },
  loginButton: { borderRadius: 12, height: 52, justifyContent: 'center', alignItems: 'center' },
  loginButtonText: { fontSize: 16, fontWeight: '700' },
  backButton: { alignItems: 'center', paddingVertical: 8 },
  backButtonText: { fontSize: 14 },
  demoOtpText: { fontSize: 12, textAlign: 'center' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8 },
  errorText: { fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { paddingHorizontal: 16, fontSize: 13 },
  guestButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 12, height: 52, borderWidth: 1 },
  guestButtonText: { fontSize: 16, fontWeight: '600' },
  privacyNote: { fontSize: 12, textAlign: 'center', marginTop: 24 },
});
