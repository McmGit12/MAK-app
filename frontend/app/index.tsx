import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/services/api';
import ForgotPasswordSheet from '../src/components/ForgotPasswordSheet';

type Step = 'email' | 'signin' | 'register';

const sanitize = (text: string) => text.replace(/<[^>]*>|javascript:|on\w+=/gi, '');

// Never label a network/server failure as a credentials problem — that misleads
// users (and app-store reviewers) into thinking the password is wrong.
const authErrorMessage = (err: any, fallback: string) => {
  if (err?.response?.data?.detail) return err.response.data.detail;
  if (!err?.response) return "Couldn't reach MAK servers. Please check your connection and try again.";
  return fallback;
};

export default function LoginScreen() {
  const router = useRouter();
  const { login, user } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user]);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSheetVisible, setForgotSheetVisible] = useState(false);

  const handleCheckEmail = async () => {
    const e = sanitize(email.trim().toLowerCase());
    if (!e) { setError('Please enter your email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Please enter a valid email address.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.checkEmail(e);
      setStep(res.exists ? 'signin' : 'register');
    } catch (err: any) {
      setError(authErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally { setLoading(false); }
  };

  const handleSignIn = async () => {
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.passwordLogin(email.trim().toLowerCase(), password);
      await login(res);
      // Navigate explicitly after successful login
      setTimeout(() => router.replace('/(tabs)'), 100);
    } catch (err: any) {
      setError(authErrorMessage(err, 'Sign in failed. Please try again.'));
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    const n = sanitize(name.trim());
    if (!n || n.length < 2) { setError('Name must be at least 2 characters.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.register(email.trim().toLowerCase(), n, password);
      await login(res);
      // Navigate explicitly after successful registration
      setTimeout(() => router.replace('/(tabs)'), 100);
    } catch (err: any) {
      setError(authErrorMessage(err, 'Registration failed. Please try again.'));
    } finally { setLoading(false); }
  };

  const goBack = () => {
    setError(''); setPassword(''); setConfirmPassword(''); setName('');
    setStep('email');
  };

  const handleForgotPassword = () => {
    setError('');
    setForgotSheetVisible(true);
  };

  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.kv}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={st.brand}>
            <View style={[st.logo, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
              <Ionicons name="sparkles" size={44} color={colors.primary} />
            </View>
            <Text style={[st.brandName, { color: colors.text }]}>MAK</Text>
            <Text style={[st.tagline, { color: colors.primary }]}>Your Personalized Makeup Buddy</Text>
          </View>

          {/* Card */}
          <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Step: Email */}
            {step === 'email' && (
              <>
                <Text style={[st.cardTitle, { color: colors.text }]}>Welcome to MAK</Text>
                <Text style={[st.cardSub, { color: colors.textSecondary }]}>Enter your email to sign in or create an account</Text>
                <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="mail" size={18} color={colors.primary} />
                  <TextInput style={[st.input, { color: colors.text }]} placeholder="Email address" placeholderTextColor={colors.textTertiary} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                </View>
                <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={handleCheckEmail} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnText}>Continue</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Step: Sign In */}
            {step === 'signin' && (
              <>
                <TouchableOpacity onPress={goBack} style={st.backRow}><Ionicons name="arrow-back" size={20} color={colors.primary} /><Text style={[st.backText, { color: colors.primary }]}>Back</Text></TouchableOpacity>
                <Text style={[st.cardTitle, { color: colors.text }]}>Welcome back!</Text>
                <Text style={[st.cardSub, { color: colors.textSecondary }]}>{email}</Text>
                <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed" size={18} color={colors.primary} />
                  <TextInput style={[st.input, { color: colors.text }]} placeholder="Password" placeholderTextColor={colors.textTertiary} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={handleSignIn} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textTertiary} /></TouchableOpacity>
                </View>
                <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={handleSignIn} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnText}>Sign In</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword} style={st.forgotRow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={[st.forgotText, { color: colors.primary }]}>Forgot password?</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step: Register */}
            {step === 'register' && (
              <>
                <TouchableOpacity onPress={goBack} style={st.backRow}><Ionicons name="arrow-back" size={20} color={colors.primary} /><Text style={[st.backText, { color: colors.primary }]}>Back</Text></TouchableOpacity>
                <Text style={[st.cardTitle, { color: colors.text }]}>Create your account</Text>
                <Text style={[st.cardSub, { color: colors.textSecondary }]}>{email}</Text>
                <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="person" size={18} color={colors.primary} />
                  <TextInput style={[st.input, { color: colors.text }]} placeholder="Full Name" placeholderTextColor={colors.textTertiary} value={name} onChangeText={t => setName(sanitize(t))} autoCapitalize="words" />
                </View>
                <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed" size={18} color={colors.primary} />
                  <TextInput style={[st.input, { color: colors.text }]} placeholder="Password (min 6 characters)" placeholderTextColor={colors.textTertiary} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textTertiary} /></TouchableOpacity>
                </View>
                <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed" size={18} color={colors.secondary} />
                  <TextInput style={[st.input, { color: colors.text }]} placeholder="Confirm Password" placeholderTextColor={colors.textTertiary} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
                </View>
                <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={handleRegister} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnText}>Create Account</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Error */}
            {error ? <View style={st.errRow}><Ionicons name="alert-circle" size={16} color={colors.error} /><Text style={[st.errText, { color: colors.error }]}>{error}</Text></View> : null}
          </View>

          <Text style={[st.privacy, { color: colors.textTertiary }]}>We respect your privacy. No personal data is shared with third parties.</Text>

          {/* Terms & Privacy */}
          <View style={st.termsRow}>
            <Text style={[st.termsText, { color: colors.textTertiary }]}>
              By continuing, you agree to our{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/terms')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={[st.termsLink, { color: colors.primary }]}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={[st.termsText, { color: colors.textTertiary }]}> and </Text>
            <TouchableOpacity onPress={() => router.push('/privacy')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={[st.termsLink, { color: colors.primary }]}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={[st.termsText, { color: colors.textTertiary }]}>.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Bottom Sheet */}
      <ForgotPasswordSheet
        visible={forgotSheetVisible}
        initialEmail={email}
        onClose={() => setForgotSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  kv: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  brand: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 2 },
  brandName: { fontSize: 38, fontWeight: '700', letterSpacing: 4 },
  tagline: { fontSize: 12, marginTop: 6, letterSpacing: 1 },
  card: { borderRadius: 22, padding: 24, borderWidth: 1 },
  cardTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  cardSub: { fontSize: 13, marginBottom: 18 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, gap: 10, marginBottom: 12 },
  input: { flex: 1, height: 50, fontSize: 15 },
  btn: { borderRadius: 12, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 4, marginBottom: 4 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { fontSize: 14, fontWeight: '600' },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: 'rgba(232,93,117,0.08)' },
  errText: { flex: 1, fontSize: 13 },
  forgotRow: { alignItems: 'center', marginTop: 14, paddingVertical: 6 },
  forgotText: { fontSize: 13, fontWeight: '600' },
  privacy: { fontSize: 11, textAlign: 'center', marginTop: 20 },
  termsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: 8, paddingHorizontal: 16 },
  termsText: { fontSize: 11, lineHeight: 16 },
  termsLink: { fontSize: 11, lineHeight: 16, fontWeight: '700', textDecorationLine: 'underline' },
});
