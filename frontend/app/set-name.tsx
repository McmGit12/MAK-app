import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/services/api';

export default function SetNameScreen() {
  const router = useRouter();
  const { user, updateUserName } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetName = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      await api.updateDisplayName(user.id, name.trim());
      updateUserName(name.trim());
      router.replace('/(tabs)');
    } catch (err: any) { setError(err.message || 'Failed to save name'); } finally { setLoading(false); }
  };

  const handleSkip = () => { router.replace('/(tabs)'); };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
              <Ionicons name="person-add" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>What should we call you?</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Add your name for a personalized experience</Text>
          </View>

          <View style={styles.inputSection}>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="person" size={20} color={colors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter your name"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoFocus
              />
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={[styles.continueButton, { backgroundColor: colors.primary }]} onPress={handleSetName} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.continueButtonText}>Continue</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>Skip for now</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.note, { color: colors.textTertiary }]}>Your name is only used for personalization within the app</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  iconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 2 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center' },
  inputSection: { gap: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 56, fontSize: 18 },
  errorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorText: { fontSize: 14 },
  continueButton: { borderRadius: 12, height: 56, justifyContent: 'center', alignItems: 'center' },
  continueButtonText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  skipButton: { padding: 12, alignItems: 'center' },
  skipButtonText: { fontSize: 14 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 40 },
});
