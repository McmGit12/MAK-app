import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/services/api';

type Step = 'email' | 'signin' | 'register' | 'phone' | 'otp';

const COUNTRY_CODES = [
  { name: 'United States', flag: '\u{1F1FA}\u{1F1F8}', code: '+1' },
  { name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}', code: '+44' },
  { name: 'India', flag: '\u{1F1EE}\u{1F1F3}', code: '+91' },
  { name: 'France', flag: '\u{1F1EB}\u{1F1F7}', code: '+33' },
  { name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', code: '+49' },
  { name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', code: '+61' },
  { name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', code: '+1' },
  { name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', code: '+81' },
  { name: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}', code: '+55' },
  { name: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}', code: '+52' },
  { name: 'Spain', flag: '\u{1F1EA}\u{1F1F8}', code: '+34' },
  { name: 'Italy', flag: '\u{1F1EE}\u{1F1F9}', code: '+39' },
  { name: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}', code: '+82' },
  { name: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', code: '+971' },
  { name: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}', code: '+65' },
  { name: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}', code: '+66' },
  { name: 'China', flag: '\u{1F1E8}\u{1F1F3}', code: '+86' },
  { name: 'Russia', flag: '\u{1F1F7}\u{1F1FA}', code: '+7' },
  { name: 'South Africa', flag: '\u{1F1FF}\u{1F1E6}', code: '+27' },
  { name: 'Turkey', flag: '\u{1F1F9}\u{1F1F7}', code: '+90' },
];

const sanitize = (text: string) => text.replace(/<[^>]*>|javascript:|on\w+=/gi, '');

export default function LoginScreen() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { if (user) router.replace('/(tabs)'); }, [user]);

  const filtered = COUNTRY_CODES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch));

  const handleCheckEmail = async () => {
    const e = sanitize(email.trim().toLowerCase());
    if (!e) { setError('Please enter your email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Please enter a valid email address.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.checkEmail(e);
      setStep(res.exists ? 'signin' : 'register');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  const handleSignIn = async () => {
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.passwordLogin(email.trim().toLowerCase(), password);
      login(res);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Incorrect password. Please try again.');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    const n = sanitize(name.trim());
    if (!n || n.length < 2) { setError('Name must be at least 2 characters.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.register(email.trim().toLowerCase(), n, password, phone ? `${countryCode.code}${phone}` : undefined, countryCode.code);
      login(res);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleRequestOtp = async () => {
    const p = phone.trim();
    if (!p || p.length < 6) { setError('Please enter a valid phone number.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.requestOtp(`${countryCode.code}${p}`);
      setDemoOtp(res.demo_otp || '');
      setStep('otp');
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to send OTP.'); } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError('Please enter a valid 6-digit OTP.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.verifyOtp(`${countryCode.code}${phone}`, otp);
      login(res);
      if (!res.display_name) router.replace('/set-name'); else router.replace('/(tabs)');
    } catch (err: any) { setError(err?.response?.data?.detail || 'Invalid OTP.'); } finally { setLoading(false); }
  };

  const handleGuest = async () => {
    setLoading(true); setError('');
    try { const res = await api.guestLogin(); login(res); router.replace('/(tabs)'); }
    catch (err: any) { setError('Guest login failed. Please try again.'); } finally { setLoading(false); }
  };

  const goBack = () => {
    setError(''); setPassword(''); setConfirmPassword('');
    if (step === 'signin' || step === 'register') setStep('email');
    else if (step === 'otp') setStep('phone');
    else setStep('email');
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

                <View style={st.divider}><View style={[st.divLine, { backgroundColor: colors.border }]} /><Text style={[st.divText, { color: colors.textTertiary }]}>or</Text><View style={[st.divLine, { backgroundColor: colors.border }]} /></View>

                <TouchableOpacity style={[st.altBtn, { borderColor: colors.border }]} onPress={() => setStep('phone')}>
                  <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
                  <Text style={[st.altBtnText, { color: colors.primary }]}>Continue with Phone</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.altBtn, { borderColor: colors.border }]} onPress={handleGuest} disabled={loading}>
                  <Ionicons name="person-outline" size={18} color={colors.secondary} />
                  <Text style={[st.altBtnText, { color: colors.secondary }]}>Continue as Guest</Text>
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
                  <TextInput style={[st.input, { color: colors.text }]} placeholder="Password" placeholderTextColor={colors.textTertiary} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textTertiary} /></TouchableOpacity>
                </View>
                <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={handleSignIn} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnText}>Sign In</Text>}
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
                  <TextInput style={[st.input, { color: colors.text }]} placeholder="Password (min 6 chars)" placeholderTextColor={colors.textTertiary} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textTertiary} /></TouchableOpacity>
                </View>
                <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed" size={18} color={colors.secondary} />
                  <TextInput style={[st.input, { color: colors.text }]} placeholder="Confirm Password" placeholderTextColor={colors.textTertiary} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                </View>
                <Text style={[st.optLabel, { color: colors.textSecondary }]}>Phone (optional)</Text>
                <View style={st.phoneRow}>
                  <TouchableOpacity style={[st.ccBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setShowCountryPicker(true)}>
                    <Text style={st.ccFlag}>{countryCode.flag}</Text>
                    <Text style={[st.ccCode, { color: colors.text }]}>{countryCode.code}</Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                  <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border, flex: 1 }]}>
                    <TextInput style={[st.input, { color: colors.text }]} placeholder="Phone number" placeholderTextColor={colors.textTertiary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  </View>
                </View>
                <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={handleRegister} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnText}>Create Account</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Step: Phone */}
            {step === 'phone' && (
              <>
                <TouchableOpacity onPress={goBack} style={st.backRow}><Ionicons name="arrow-back" size={20} color={colors.primary} /><Text style={[st.backText, { color: colors.primary }]}>Back</Text></TouchableOpacity>
                <Text style={[st.cardTitle, { color: colors.text }]}>Phone Login</Text>
                <View style={st.phoneRow}>
                  <TouchableOpacity style={[st.ccBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setShowCountryPicker(true)}>
                    <Text style={st.ccFlag}>{countryCode.flag}</Text>
                    <Text style={[st.ccCode, { color: colors.text }]}>{countryCode.code}</Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                  <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border, flex: 1 }]}>
                    <TextInput style={[st.input, { color: colors.text }]} placeholder="Phone number" placeholderTextColor={colors.textTertiary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  </View>
                </View>
                <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={handleRequestOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnText}>Send OTP</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Step: OTP */}
            {step === 'otp' && (
              <>
                <TouchableOpacity onPress={goBack} style={st.backRow}><Ionicons name="arrow-back" size={20} color={colors.primary} /><Text style={[st.backText, { color: colors.primary }]}>Back</Text></TouchableOpacity>
                <Text style={[st.cardTitle, { color: colors.text }]}>Verify OTP</Text>
                <Text style={[st.cardSub, { color: colors.textSecondary }]}>Sent to {countryCode.code} {phone}</Text>
                <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Ionicons name="keypad" size={18} color={colors.primary} />
                  <TextInput style={[st.input, { color: colors.text }]} placeholder="6-digit OTP" placeholderTextColor={colors.textTertiary} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                </View>
                {demoOtp ? <Text style={[st.demo, { color: colors.textSecondary }]}>Demo OTP: {demoOtp}</Text> : null}
                <TouchableOpacity style={[st.btn, { backgroundColor: colors.primary }]} onPress={handleVerifyOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnText}>Verify</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Error */}
            {error ? <View style={st.errRow}><Ionicons name="alert-circle" size={16} color={colors.error} /><Text style={[st.errText, { color: colors.error }]}>{error}</Text></View> : null}
          </View>

          <Text style={[st.privacy, { color: colors.textTertiary }]}>We respect your privacy. No personal data is shared with third parties.</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Code Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={[st.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[st.modalContent, { backgroundColor: colors.background }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: colors.text }]}>Select Country Code</Text>
              <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <View style={[st.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput style={[st.searchInput, { color: colors.text }]} placeholder="Search..." placeholderTextColor={colors.textTertiary} value={countrySearch} onChangeText={setCountrySearch} />
            </View>
            <FlatList data={filtered} keyExtractor={i => i.name + i.code} renderItem={({ item }) => (
              <TouchableOpacity style={[st.ccRow, { borderBottomColor: colors.borderLight }]} onPress={() => { setCountryCode(item); setShowCountryPicker(false); setCountrySearch(''); }}>
                <Text style={st.ccRowFlag}>{item.flag}</Text>
                <Text style={[st.ccRowName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[st.ccRowCode, { color: colors.textSecondary }]}>{item.code}</Text>
                {countryCode.name === item.name && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>
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
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  divLine: { flex: 1, height: 1 },
  divText: { paddingHorizontal: 14, fontSize: 13 },
  altBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 12, height: 48, borderWidth: 1, marginBottom: 10 },
  altBtnText: { fontSize: 15, fontWeight: '600' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { fontSize: 14, fontWeight: '600' },
  optLabel: { fontSize: 12, marginBottom: 8, marginTop: 4 },
  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  ccBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 50 },
  ccFlag: { fontSize: 20 },
  ccCode: { fontSize: 14, fontWeight: '600' },
  demo: { fontSize: 12, textAlign: 'center', marginBottom: 8 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: 'rgba(232,93,117,0.08)' },
  errText: { flex: 1, fontSize: 13 },
  privacy: { fontSize: 11, textAlign: 'center', marginTop: 20 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 60 },
  modalContent: { borderRadius: 20, padding: 20, flex: 1, maxHeight: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  ccRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  ccRowFlag: { fontSize: 24 },
  ccRowName: { flex: 1, fontSize: 15 },
  ccRowCode: { fontSize: 14, fontWeight: '600' },
});
