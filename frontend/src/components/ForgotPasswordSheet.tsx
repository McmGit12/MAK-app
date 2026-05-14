import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

type Step = 'enterEmail' | 'success';

interface Props {
  visible: boolean;
  initialEmail?: string;
  onClose: () => void;
}

const sanitize = (text: string) => text.replace(/<[^>]*>|javascript:|on\w+=/gi, '');

export default function ForgotPasswordSheet({ visible, initialEmail = '', onClose }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>('enterEmail');
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentToEmail, setSentToEmail] = useState('');

  // Reset internal state when the sheet re-opens
  useEffect(() => {
    if (visible) {
      setStep('enterEmail');
      setEmail(initialEmail);
      setError('');
      setLoading(false);
    }
  }, [visible, initialEmail]);

  const handleSend = async () => {
    const e = sanitize(email.trim().toLowerCase());
    if (!e) {
      setError('Please enter your email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Real wiring will be added after backend endpoint is built.
      // For now, simulate a successful request so the UI can be reviewed.
      if (typeof (api as any).forgotPassword === 'function') {
        await (api as any).forgotPassword(e);
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }
      setSentToEmail(e);
      setStep('success');
    } catch {
      // Even on error, respond with neutral success message — never leak whether
      // the email is registered. (Anti-enumeration.) Backend will handle the real
      // case; this UI fallback keeps UX consistent if network blips during preview.
      setSentToEmail(e);
      setStep('success');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable
          style={[s.sheet, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Drag handle */}
              <View style={[s.handle, { backgroundColor: colors.border }]} />

              {/* Close (X) */}
              <TouchableOpacity
                style={s.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textTertiary} />
              </TouchableOpacity>

              {step === 'enterEmail' && (
                <View style={s.body}>
                  <View style={[s.iconCircle, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="lock-open-outline" size={28} color={colors.primary} />
                  </View>
                  <Text style={[s.title, { color: colors.text }]}>Reset your password</Text>
                  <Text style={[s.subtitle, { color: colors.textSecondary }]}>
                    Enter the email you used to sign up and we&apos;ll send you a secure link to
                    create a new password.
                  </Text>

                  <View
                    style={[
                      s.inputWrap,
                      { backgroundColor: colors.inputBg, borderColor: colors.border },
                    ]}
                  >
                    <Ionicons name="mail" size={18} color={colors.primary} />
                    <TextInput
                      style={[s.input, { color: colors.text }]}
                      placeholder="Email address"
                      placeholderTextColor={colors.textTertiary}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (error) setError('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {error ? (
                    <View style={s.errRow}>
                      <Ionicons name="alert-circle" size={16} color={colors.error} />
                      <Text style={[s.errText, { color: colors.error }]}>{error}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSend}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={s.primaryBtnText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                    <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 'success' && (
                <View style={s.body}>
                  <View style={[s.iconCircle, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="mail-unread-outline" size={28} color={colors.primary} />
                  </View>
                  <Text style={[s.title, { color: colors.text }]}>Check your email</Text>
                  <Text style={[s.subtitle, { color: colors.textSecondary }]}>
                    If <Text style={{ fontWeight: '700' }}>{sentToEmail}</Text> is registered with
                    MAK, you&apos;ll receive a reset link within a minute.
                  </Text>

                  <View style={[s.tip, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="information-circle" size={18} color={colors.primary} />
                    <Text style={[s.tipText, { color: colors.text }]}>
                      Didn&apos;t get it? Check your spam folder. The link expires in 30 minutes.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: colors.primary }]}
                    onPress={onClose}
                  >
                    <Text style={s.primaryBtnText}>Got it</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.cancelBtn}
                    onPress={() => setStep('enterEmail')}
                  >
                    <Text style={[s.cancelText, { color: colors.textSecondary }]}>
                      Use a different email
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  body: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
    width: '100%',
    marginBottom: 4,
  },
  input: { flex: 1, height: 50, fontSize: 15 },
  errRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(232,93,117,0.08)',
    width: '100%',
  },
  errText: { flex: 1, fontSize: 13 },
  primaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, marginTop: 4 },
  cancelText: { fontSize: 14, fontWeight: '600' },
  tip: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginTop: 4,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
