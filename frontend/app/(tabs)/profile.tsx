import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';

const FAQS = [
  { q: 'What does MAK do?', a: 'MAK analyzes your skin and facial features using your photo, then provides personalized skincare routines, makeup suggestions, and travel styling tips tailored to you.' },
  { q: 'Is my photo stored anywhere?', a: 'No. Your photo is analyzed in real-time and immediately discarded. We never store your images on our servers.' },
  { q: 'How accurate are the skin analysis results?', a: 'Our analysis provides a helpful starting point based on visible features. For medical skin concerns, we always recommend consulting a dermatologist.' },
  { q: 'Can I use the app without creating an account?', a: 'Yes! You can use MAK as a guest. However, creating an account lets you save your analysis history and preferences.' },
  { q: 'What kind of makeup suggestions does MAK provide?', a: 'MAK suggests blush types, lip colors, eye makeup, contouring, brow styling, and even hair styling tips — all personalized to your face shape, skin tone, and features.' },
  { q: 'How does the Travel Style feature work?', a: 'Select your destination country, travel month, and occasion. MAK considers the local weather, culture, and event type to suggest outfits and makeup looks.' },
  { q: 'Is MAK free to use?', a: 'Yes, MAK is completely free. All features including skin analysis, makeup suggestions, travel styling, and the Ask MAK chatbot are available at no cost.' },
  { q: 'Can I use MAK with makeup already on?', a: 'Absolutely! The Makeup Suggestions mode works with or without makeup. For Skin Care analysis, a clean face gives the most accurate results.' },
  { q: 'What is the Ask MAK chatbot?', a: 'Ask MAK is your personal beauty assistant. You can ask any beauty, skincare, or makeup question and get instant, personalized advice.' },
  { q: 'Does MAK work for all skin tones and types?', a: 'Yes! MAK is designed to work with all skin tones (fair to deep), all skin types (oily, dry, combination, sensitive, normal), and all face shapes.' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [showFeedback, setShowFeedback] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState('app_experience');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleShareApp = async () => {
    try {
      await Share.share({ message: 'Check out MAK - Your Personalized Makeup Buddy! Get personalized skin analysis and makeup recommendations.', title: 'MAK' });
    } catch (error: any) {
      if (error.message !== 'User did not share') Alert.alert('Oops!', 'Unable to share right now. Please try again.');
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/');
    } catch (err) {
      Alert.alert('Oops!', 'Something went wrong while logging out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Logout', style: 'destructive', onPress: handleLogout },
      ]
    );
  };

  const submitFeedback = async () => {
    if (!user?.id) { Alert.alert('Oops!', 'Please log in to submit feedback.'); return; }
    setSubmitting(true);
    try {
      await api.submitFeedback({ user_id: user.id, rating: feedbackRating, category: feedbackCategory, comment: feedbackComment || undefined });
      Alert.alert('Thank You!', 'Your feedback has been submitted successfully.');
      setShowFeedback(false);
      setFeedbackComment('');
      setFeedbackRating(5);
    } catch (err: any) {
      Alert.alert('Oops!', 'Failed to submit feedback. Please check your connection and try again.');
    } finally { setSubmitting(false); }
  };

  const categories = [
    { id: 'app_experience', label: 'App Experience', icon: 'phone-portrait' },
    { id: 'recommendations', label: 'Recommendations', icon: 'sparkles' },
    { id: 'analysis_accuracy', label: 'Analysis Accuracy', icon: 'analytics' },
  ];

  const menuItems = [
    { icon: 'help-circle-outline', title: 'FAQ', description: 'Frequently asked questions', onPress: () => setShowFAQ(!showFAQ), accent: colors.tertiary },
    { icon: 'share-social-outline', title: 'Share App', description: 'Invite friends to try MAK', onPress: handleShareApp, accent: colors.primary },
    { icon: 'chatbubble-outline', title: 'Give Feedback', description: 'Help us improve', onPress: () => setShowFeedback(true), accent: colors.secondary },
    { icon: 'shield-checkmark-outline', title: 'Privacy Policy', description: 'Your data is safe with us', onPress: () => Alert.alert('Privacy Policy', 'MAK does not store any personal identifying information. Your photos are analyzed in real-time and immediately discarded. We do not share your data with third parties.'), accent: colors.accent },
    { icon: 'information-circle-outline', title: 'About MAK', description: 'Version 1.0.0', onPress: () => Alert.alert('About MAK', 'Version 1.0.0\n\nYour personalized makeup buddy that provides skin analysis, makeup suggestions, travel styling, and beauty advice — all powered by advanced technology.\n\nMade with love for your beauty journey.'), accent: colors.primary },
  ];

  return (
    <SafeAreaView style={[st.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[st.title, { color: colors.text }]}>Profile</Text>

        {/* User Card */}
        <View style={[st.userCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <View style={[st.avatar, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
          <View style={st.userInfo}>
            <Text style={[st.userName, { color: colors.text }]}>{user?.display_name || 'Guest User'}</Text>
            <Text style={[st.userMethod, { color: colors.textSecondary }]}>Logged in via {user?.login_method || 'guest'}</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={[st.menuSection, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={[st.menuItem, index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={item.onPress} activeOpacity={0.7}>
              <View style={[st.menuIcon, { backgroundColor: item.accent + '18' }]}>
                <Ionicons name={item.icon as any} size={20} color={item.accent} />
              </View>
              <View style={st.menuContent}>
                <Text style={[st.menuTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[st.menuDesc, { color: colors.textSecondary }]}>{item.description}</Text>
              </View>
              <Ionicons name={item.title === 'FAQ' && showFAQ ? 'chevron-up' : 'chevron-forward'} size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ Section */}
        {showFAQ && (
          <View style={[st.faqSection, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={st.faqHeader}>
              <Ionicons name="help-circle" size={22} color={colors.tertiary} />
              <Text style={[st.faqHeaderText, { color: colors.text }]}>Frequently Asked Questions</Text>
            </View>
            {FAQS.map((faq, i) => (
              <TouchableOpacity key={i} style={[st.faqItem, { borderBottomColor: colors.borderLight }]} onPress={() => setExpandedFAQ(expandedFAQ === i ? null : i)} activeOpacity={0.7}>
                <View style={st.faqQuestion}>
                  <Text style={[st.faqQText, { color: colors.text }]}>{faq.q}</Text>
                  <Ionicons name={expandedFAQ === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
                </View>
                {expandedFAQ === i && (
                  <Text style={[st.faqAnswer, { color: colors.textSecondary }]}>{faq.a}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={[st.logoutBtn, { borderColor: colors.error + '40' }]} onPress={confirmLogout} disabled={loggingOut}>
          {loggingOut ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={22} color={colors.error} />
              <Text style={[st.logoutText, { color: colors.error }]}>Logout</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Disclaimer */}
        <View style={st.disclaimerRow}>
          <Ionicons name="shield-checkmark-outline" size={12} color={colors.textTertiary} />
          <Text style={[st.disclaimerText, { color: colors.textTertiary }]}>We respect your privacy and do not store personal data. Try recommendations at your own discretion.</Text>
        </View>

        {/* Feedback Modal */}
        {showFeedback && (
          <View style={[st.overlay, { backgroundColor: colors.overlay }]}>
            <View style={[st.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={st.modalHeader}>
                <Text style={[st.modalTitle, { color: colors.text }]}>Share Feedback</Text>
                <TouchableOpacity onPress={() => setShowFeedback(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
              </View>
              <Text style={[st.label, { color: colors.textSecondary }]}>Rating</Text>
              <View style={st.stars}>
                {[1, 2, 3, 4, 5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setFeedbackRating(s)}>
                    <Ionicons name={s <= feedbackRating ? 'star' : 'star-outline'} size={30} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[st.label, { color: colors.textSecondary }]}>Category</Text>
              <View style={st.catOptions}>
                {categories.map(c => (
                  <TouchableOpacity key={c.id} style={[st.catOption, { backgroundColor: feedbackCategory === c.id ? colors.primary : colors.surfaceVariant, borderColor: feedbackCategory === c.id ? colors.primary : colors.border }]} onPress={() => setFeedbackCategory(c.id)}>
                    <Ionicons name={c.icon as any} size={16} color={feedbackCategory === c.id ? '#FFF' : colors.primary} />
                    <Text style={[st.catText, { color: feedbackCategory === c.id ? '#FFF' : colors.primary }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[st.label, { color: colors.textSecondary }]}>Comments (Optional)</Text>
              <TextInput style={[st.commentInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Share your thoughts..." placeholderTextColor={colors.textTertiary} value={feedbackComment} onChangeText={setFeedbackComment} multiline numberOfLines={3} textAlignVertical="top" />
              <TouchableOpacity style={[st.submitBtn, { backgroundColor: colors.primary }]} onPress={submitFeedback} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={st.submitText}>Submit Feedback</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  userCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '700', marginBottom: 3 },
  userMethod: { fontSize: 12, textTransform: 'capitalize' },
  menuSection: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  menuIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  menuDesc: { fontSize: 11 },
  // FAQ
  faqSection: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  faqHeaderText: { fontSize: 16, fontWeight: '700' },
  faqItem: { borderBottomWidth: 1, paddingVertical: 14 },
  faqQuestion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQText: { flex: 1, fontSize: 14, fontWeight: '600', marginRight: 8 },
  faqAnswer: { fontSize: 13, lineHeight: 20, marginTop: 10 },
  // Logout
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  logoutText: { fontSize: 16, fontWeight: '600' },
  // Disclaimer
  disclaimerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, paddingHorizontal: 4 },
  disclaimerText: { flex: 1, fontSize: 10, lineHeight: 14 },
  // Feedback
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 20 },
  modal: { borderRadius: 20, padding: 22, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 14 },
  stars: { flexDirection: 'row', gap: 8 },
  catOptions: { gap: 8 },
  catOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  catText: { fontSize: 13, fontWeight: '500' },
  commentInput: { borderRadius: 12, padding: 14, fontSize: 13, minHeight: 80, borderWidth: 1, marginTop: 4 },
  submitBtn: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
