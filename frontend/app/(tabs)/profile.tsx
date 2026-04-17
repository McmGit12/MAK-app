import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState('app_experience');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out MAK - Your Personalized Makeup Buddy! Get personalized skin analysis and makeup recommendations.',
        title: 'MAK - Your Personalized Makeup Buddy',
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') Alert.alert('Error', 'Unable to share at this time');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => { logout(); router.replace('/'); } },
    ]);
  };

  const submitFeedback = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      await api.submitFeedback({ user_id: user.id, rating: feedbackRating, category: feedbackCategory, comment: feedbackComment || undefined });
      Alert.alert('Thank You!', 'Your feedback has been submitted successfully.');
      setShowFeedback(false);
      setFeedbackComment('');
      setFeedbackRating(5);
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed to submit feedback'); } finally { setSubmitting(false); }
  };

  const categories = [
    { id: 'app_experience', label: 'App Experience', icon: 'phone-portrait' },
    { id: 'recommendations', label: 'Recommendations', icon: 'sparkles' },
    { id: 'analysis_accuracy', label: 'Analysis Accuracy', icon: 'analytics' },
  ];

  const menuItems = [
    { icon: 'share-social-outline', title: 'Share App', description: 'Invite friends to try MAK', onPress: handleShareApp },
    { icon: 'chatbubble-outline', title: 'Give Feedback', description: 'Help us improve', onPress: () => setShowFeedback(true) },
    { icon: 'shield-checkmark-outline', title: 'Privacy Policy', description: 'Your data is safe with us', onPress: () => Alert.alert('Privacy', 'We do not store any personal identifying information. Your photos are analyzed and immediately discarded.') },
    { icon: 'information-circle-outline', title: 'About', description: 'Learn more about MAK', onPress: () => Alert.alert('MAK', 'Version 1.0.0\n\nYour personalized makeup buddy that analyzes your skin and provides personalized makeup recommendations.') },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
        </View>

        <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>{user?.display_name || 'User'}</Text>
            <Text style={[styles.userMethod, { color: colors.textSecondary }]}>Logged in via {user?.login_method || 'email'}</Text>
          </View>
        </View>

        <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={[styles.menuItem, index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={item.onPress} activeOpacity={0.7}>
              <View style={[styles.menuItemIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={item.icon as any} size={22} color={colors.primary} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.logoutButton, { borderColor: colors.error + '40' }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>

        {showFeedback && (
          <View style={[styles.feedbackOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.feedbackModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.feedbackHeader}>
                <Text style={[styles.feedbackTitle, { color: colors.text }]}>Share Feedback</Text>
                <TouchableOpacity onPress={() => setShowFeedback(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.ratingSection}>
                <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>Rating</Text>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)}>
                      <Ionicons name={star <= feedbackRating ? 'star' : 'star-outline'} size={32} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.categorySection}>
                <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>Category</Text>
                <View style={styles.categoryOptions}>
                  {categories.map((cat) => (
                    <TouchableOpacity key={cat.id} style={[styles.categoryOption, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }, feedbackCategory === cat.id && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setFeedbackCategory(cat.id)}>
                      <Ionicons name={cat.icon as any} size={18} color={feedbackCategory === cat.id ? '#FFF' : colors.primary} />
                      <Text style={[styles.categoryOptionText, { color: feedbackCategory === cat.id ? '#FFF' : colors.primary }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.commentSection}>
                <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>Comments (Optional)</Text>
                <TextInput style={[styles.commentInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Share your thoughts..." placeholderTextColor={colors.textTertiary} value={feedbackComment} onChangeText={setFeedbackComment} multiline numberOfLines={4} textAlignVertical="top" />
              </View>
              <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={submitFeedback} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Submit Feedback</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  userCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1 },
  avatarContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  userMethod: { fontSize: 13, textTransform: 'capitalize' },
  menuSection: { borderRadius: 16, overflow: 'hidden', marginBottom: 24, borderWidth: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuItemIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuItemContent: { flex: 1 },
  menuItemTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  menuItemDescription: { fontSize: 12 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, borderWidth: 1 },
  logoutText: { fontSize: 16, fontWeight: '600' },
  feedbackOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 20 },
  feedbackModal: { borderRadius: 20, padding: 24, borderWidth: 1 },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  feedbackTitle: { fontSize: 20, fontWeight: '700' },
  feedbackLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  ratingSection: { marginBottom: 24 },
  ratingStars: { flexDirection: 'row', gap: 8 },
  categorySection: { marginBottom: 24 },
  categoryOptions: { gap: 10 },
  categoryOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1 },
  categoryOptionText: { fontSize: 14, fontWeight: '500' },
  commentSection: { marginBottom: 24 },
  commentInput: { borderRadius: 12, padding: 16, fontSize: 14, minHeight: 100, borderWidth: 1 },
  submitButton: { borderRadius: 12, padding: 16, alignItems: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
