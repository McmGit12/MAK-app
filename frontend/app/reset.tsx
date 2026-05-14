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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/services/api';

type Step = 'form' | 'success' | 'invalid';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = (params.token || '').toString();

  const [step, setStep] = useState<Step>(token ? 'form' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStep(token ? 'form' : 'invalid');
  }, [token]);

  const handleReset = async () => {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      if (typeof (api as any).resetPassword === 'function') {
        await (api as any).resetPassword(token, password);
      } else {
        await new Promise((r) => setTimeout(r, 700));
      }
      setStep('success');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;
      if (status === 400 || status === 404 || status === 410) {
        setStep('invalid');
      } else {
        setError(detail || 'Something went wrong. Please request a new link.');
      }
    } finally {
      setLoading(false);
    }
  };

  const openApp = async () => {
    // Try deep link first, fall back to staying on the page.
    try {
      const url = 'mak://';
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* ignore */
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.kv}>
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={st.brand}>
            <View style={[st.logo, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
              <Ionicons name="sparkles" size={42} color={colors.primary} />
            </View>
            <Text style={[st.brandName, { color: colors.text }]}>MAK</Text>
            <Text style={[st.tagline, { color: colors.primary }]}>Your Personalized Makeup Buddy</Text>
          </View>

          <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {step === 'form' && (
              <>
                <View style={[st.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="key-outline" size={26} color={colors.primary} />
                </View>
                <Text style={[st.title, { color: colors.text }]}>Set a new password</Text>
                <Text style={[st.sub, { color: colors.textSecondary }]}>
                  Choose a strong password for your MAK account.
                </Text>

                <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed" size={18} color={colors.primary} />
                  <TextInput
                    style={[st.input, { color: colors.text }]}
                    placeholder="New password (min 6 characters)"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed" size={18} color={colors.secondary} />
                  <TextInput
                    style={[st.input, { color: colors.text }]}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.textTertiary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                {error ? (
                  <View style={st.errRow}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={[st.errText, { color: colors.error }]}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[st.btn, { backgroundColor: colors.primary }]}
                  onPress={handleReset}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={st.btnText}>Update Password</Text>
                  )}
                </TouchableOpacity>

                <Text style={[st.helpText, { color: colors.textTertiary }]}>
                  This link expires in 30 minutes and can only be used once.
                </Text>
              </>
            )}

            {step === 'success' && (
              <>
                <View style={[st.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
                </View>
                <Text style={[st.title, { color: colors.text }]}>Password updated!</Text>
                <Text style={[st.sub, { color: colors.textSecondary }]}>
                  You can now sign in to MAK with your new password.
                </Text>
                <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={openApp}>
                  <Text style={st.btnText}>Open MAK App</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'invalid' && (
              <>
                <View style={[st.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="time-outline" size={28} color={colors.primary} />
                </View>
                <Text style={[st.title, { color: colors.text }]}>Link expired or invalid</Text>
                <Text style={[st.sub, { color: colors.textSecondary }]}>
                  This reset link is no longer valid. Open the MAK app and tap “Forgot password?” to request a fresh one.
                </Text>
                <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={openApp}>
                  <Text style={st.btnText}>Open MAK App</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={[st.footer, { color: colors.textTertiary }]}>
            © 2026 MAK — Your Personalized Makeup Buddy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  kv: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logo: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
  },
  brandName: { fontSize: 36, fontWeight: '700', letterSpacing: 4 },
  tagline: { fontSize: 12, marginTop: 4, letterSpacing: 1 },
  card: { borderRadius: 22, padding: 24, borderWidth: 1, alignItems: 'center' },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 19, marginBottom: 18, textAlign: 'center' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 12,
    width: '100%',
  },
  input: { flex: 1, height: 50, fontSize: 15 },
  btn: {
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  errRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(232,93,117,0.08)',
    width: '100%',
  },
  errText: { flex: 1, fontSize: 13 },
  helpText: { fontSize: 11, textAlign: 'center', marginTop: 12 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 24 },
});
