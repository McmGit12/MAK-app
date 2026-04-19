import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/services/api';

const maskEmail = (email?: string) => {
  if (!email) return 'Not provided';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const local = parts[0];
  const domain = parts[1];
  const masked = local.charAt(0) + '***' + (local.length > 1 ? local.charAt(local.length - 1) : '');
  return masked + '@' + domain;
};

const maskPhone = (phone?: string) => {
  if (!phone) return 'Not provided';
  if (phone.length <= 4) return '****';
  return phone.slice(0, 3) + '****' + phone.slice(-2);
};

const sanitize = (text: string) => text.replace(/<[^>]*>|javascript:|on\w+=/gi, '');

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUserName, login } = useAuth();
  const { colors } = useTheme();
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [profileLoading, setProfileLoading] = useState(true);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [nameError, setNameError] = useState('');
  const [pwError, setPwError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Fetch fresh profile data from backend
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) { setProfileLoading(false); return; }
      try {
        const profile = await api.getProfile(user.id);
        if (profile.email) setProfileEmail(profile.email);
        if (profile.display_name) setDisplayName(profile.display_name);
        // Update local session with fresh data
        await login({ ...user, email: profile.email, display_name: profile.display_name });
      } catch (err) {
        console.log('Could not refresh profile');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSaveName = async () => {
    const name = sanitize(displayName.trim());
    if (!name || name.length < 2) { setNameError('Name must be at least 2 characters.'); return; }
    if (!user?.id) return;
    setSaving(true); setNameError(''); setNameSuccess('');
    try {
      await api.updateDisplayName(user.id, name);
      updateUserName(name);
      setNameSuccess('Name updated successfully!');
    } catch (err: any) {
      setNameError(err?.response?.data?.detail || 'Failed to update name. Please try again.');
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    setPwError(''); setPwSuccess('');
    if (!currentPassword) { setPwError('Please enter your current password.'); return; }
    if (newPassword.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (/(<[^>]*>|javascript:|on\w+=)/i.test(newPassword)) { setPwError('Invalid characters in password.'); return; }
    if (newPassword !== confirmPassword) { setPwError('New passwords do not match.'); return; }
    if (currentPassword === newPassword) { setPwError('New password must be different from current.'); return; }
    if (!user?.id) { setPwError('Please log in again.'); return; }

    setSavingPw(true);
    try {
      await api.changePassword(user.id, currentPassword, newPassword);
      setPwSuccess('Password updated successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      setPwError(err?.response?.data?.detail || 'Failed to change password. Please check your current password.');
    } finally { setSavingPw(false); }
  };

  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={st.header}>
            <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[st.title, { color: colors.text }]}>Account Settings</Text>
          </View>

          {/* Profile Info */}
          <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={[st.avatarLg, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="person" size={40} color={colors.primary} />
            </View>
            <Text style={[st.sectionTitle, { color: colors.text }]}>Personal Information</Text>

            {/* Email */}
            <View style={st.fieldRow}>
              <View style={[st.fieldIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="mail" size={18} color={colors.primary} />
              </View>
              <View style={st.fieldContent}>
                <Text style={[st.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
                <Text style={[st.fieldValue, { color: colors.text }]}>{profileLoading ? 'Loading...' : maskEmail(profileEmail)}</Text>
              </View>
              <Ionicons name="lock-closed" size={16} color={colors.textTertiary} />
            </View>

            {/* Phone */}
            <View style={st.fieldRow}>
              <View style={[st.fieldIcon, { backgroundColor: colors.secondaryLight }]}>
                <Ionicons name="phone-portrait" size={18} color={colors.secondary} />
              </View>
              <View style={st.fieldContent}>
                <Text style={[st.fieldLabel, { color: colors.textSecondary }]}>Phone</Text>
                <Text style={[st.fieldValue, { color: colors.text }]}>
                  {user?.login_method === 'phone' ? maskPhone(user?.user_hash) : 'Not provided'}
                </Text>
              </View>
              <Ionicons name="lock-closed" size={16} color={colors.textTertiary} />
            </View>

            {/* Login Method */}
            <View style={st.fieldRow}>
              <View style={[st.fieldIcon, { backgroundColor: colors.tertiaryLight }]}>
                <Ionicons name="finger-print" size={18} color={colors.tertiary} />
              </View>
              <View style={st.fieldContent}>
                <Text style={[st.fieldLabel, { color: colors.textSecondary }]}>Login Method</Text>
                <Text style={[st.fieldValue, { color: colors.text, textTransform: 'capitalize' }]}>{user?.login_method || 'Guest'}</Text>
              </View>
            </View>
          </View>

          {/* Edit Display Name */}
          <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={[st.sectionTitle, { color: colors.text }]}>Display Name</Text>
            <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: nameError ? colors.error : colors.border }]}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
              <TextInput style={[st.input, { color: colors.text }]} value={displayName} onChangeText={t => { setDisplayName(sanitize(t)); setNameError(''); setNameSuccess(''); }} placeholder="Your display name" placeholderTextColor={colors.textTertiary} autoCapitalize="words" />
            </View>
            {nameError ? <Text style={[st.errorMsg, { color: colors.error }]}>{nameError}</Text> : null}
            {nameSuccess ? <Text style={[st.successMsg, { color: colors.success }]}>{nameSuccess}</Text> : null}
            <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveName} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={st.saveBtnText}>Save Name</Text>}
            </TouchableOpacity>
          </View>

          {/* Change Password */}
          {user?.login_method === 'email' && (
            <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <TouchableOpacity style={st.sectionToggle} onPress={() => { setShowPasswordSection(!showPasswordSection); setPwError(''); setPwSuccess(''); }}>
                <View style={st.sectionToggleLeft}>
                  <Ionicons name="lock-closed" size={20} color={colors.primary} />
                  <Text style={[st.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Change Password</Text>
                </View>
                <Ionicons name={showPasswordSection ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textTertiary} />
              </TouchableOpacity>

              {showPasswordSection && (
                <View style={st.pwSection}>
                  <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: pwError && !currentPassword ? colors.error : colors.border }]}>
                    <Ionicons name="lock-closed" size={18} color={colors.secondary} />
                    <TextInput style={[st.input, { color: colors.text }]} value={currentPassword} onChangeText={t => { setCurrentPassword(t); setPwError(''); }} placeholder="Current password" placeholderTextColor={colors.textTertiary} secureTextEntry={!showCurrent} />
                    <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}><Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={18} color={colors.textTertiary} /></TouchableOpacity>
                  </View>
                  <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: pwError && newPassword.length > 0 && newPassword.length < 6 ? colors.error : colors.border }]}>
                    <Ionicons name="key" size={18} color={colors.primary} />
                    <TextInput style={[st.input, { color: colors.text }]} value={newPassword} onChangeText={t => { setNewPassword(t); setPwError(''); }} placeholder="New password (min 6 chars)" placeholderTextColor={colors.textTertiary} secureTextEntry={!showNew} />
                    <TouchableOpacity onPress={() => setShowNew(!showNew)}><Ionicons name={showNew ? 'eye-off' : 'eye'} size={18} color={colors.textTertiary} /></TouchableOpacity>
                  </View>
                  <View style={[st.inputWrap, { backgroundColor: colors.inputBg, borderColor: pwError && confirmPassword !== newPassword ? colors.error : colors.border }]}>
                    <Ionicons name="key" size={18} color={colors.tertiary} />
                    <TextInput style={[st.input, { color: colors.text }]} value={confirmPassword} onChangeText={t => { setConfirmPassword(t); setPwError(''); }} placeholder="Confirm new password" placeholderTextColor={colors.textTertiary} secureTextEntry />
                  </View>
                  {pwError ? <Text style={[st.errorMsg, { color: colors.error }]}>{pwError}</Text> : null}
                  {pwSuccess ? <Text style={[st.successMsg, { color: colors.success }]}>{pwSuccess}</Text> : null}
                  <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.primary }]} onPress={handleChangePassword} disabled={savingPw}>
                    {savingPw ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={st.saveBtnText}>Update Password</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View style={st.disclaimerRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color={colors.textTertiary} />
            <Text style={[st.disclaimerText, { color: colors.textTertiary }]}>Your data is encrypted and secure. Passwords are always masked and never stored in plain text.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  avatarLg: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  fieldValue: { fontSize: 15, fontWeight: '500' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, gap: 10, marginBottom: 10 },
  input: { flex: 1, height: 48, fontSize: 15 },
  saveBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  errorMsg: { fontSize: 13, marginBottom: 6 },
  successMsg: { fontSize: 13, marginBottom: 6 },
  sectionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pwSection: { marginTop: 16, gap: 2 },
  disclaimerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, paddingHorizontal: 4 },
  disclaimerText: { flex: 1, fontSize: 10, lineHeight: 14 },
});
