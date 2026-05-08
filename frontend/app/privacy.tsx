import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';

const SECTIONS: { title: string; body: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    icon: 'shield-checkmark-outline',
    title: 'What we collect',
    body: 'When you sign up we store your email address, an optional display name, and a securely-hashed password. We do NOT collect your phone number, real name, address, age, or any government-issued identifiers.',
  },
  {
    icon: 'image-outline',
    title: 'Your photos',
    body: 'Photos you take or upload are sent to our servers ONLY for the purpose of generating your skincare or makeup analysis. We do not sell, share, or use your photos for training any model. Once your analysis is generated, the analysis results (e.g. skin type, recommendations) are saved to your account so you can view them later in History; the source photo itself is also stored encrypted in your account so you can review past scans, and is never shown to anyone else.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'How your data is protected',
    body: 'All requests between the app and our servers use HTTPS. Your password is hashed with bcrypt — even our team cannot read it. Your account data is stored in an access-controlled database and is never sold or shared with advertisers.',
  },
  {
    icon: 'globe-outline',
    title: 'Third-party services',
    body: 'We use OpenAI\u2019s GPT-4o vision model to analyze your photos and generate beauty recommendations. OpenAI processes the image solely to return the analysis and does not retain it for training. We do not integrate any analytics, ad networks, or social trackers.',
  },
  {
    icon: 'trash-outline',
    title: 'Deleting your data',
    body: 'You can delete your account at any time from Profile \u2192 Delete Account, or by emailing makapp.support@gmail.com. Account deletion permanently removes your email, password hash, display name, and all your past analyses from our servers within 7 days.',
  },
  {
    icon: 'people-outline',
    title: 'Children',
    body: 'MAK is intended for users 13 years of age and older. We do not knowingly collect data from children under 13. If you believe a child has signed up, please contact us and we will delete the account.',
  },
  {
    icon: 'document-text-outline',
    title: 'Disclaimer',
    body: 'MAK is a beauty styling assistant — not a medical service. Skin analyses and recommendations are for informational/cosmetic purposes only and are NOT a substitute for advice from a licensed dermatologist or medical professional. Try suggested products at your own discretion.',
  },
  {
    icon: 'mail-outline',
    title: 'Questions or concerns',
    body: 'If you have any questions about this policy or want to exercise your data rights, email us at makapp.support@gmail.com. We respond within 5 business days.',
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}>
          <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
          <Text style={[s.heroTitle, { color: colors.text }]}>Your data is safe with us</Text>
          <Text style={[s.heroBody, { color: colors.textSecondary }]}>
            We collect only what we need to give you a great beauty experience — and never sell your data.
          </Text>
          <Text style={[s.heroDate, { color: colors.textTertiary }]}>Last updated: 15 February 2026</Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((sec, i) => (
          <View key={i} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={s.cardHeader}>
              <View style={[s.iconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={sec.icon} size={20} color={colors.primary} />
              </View>
              <Text style={[s.cardTitle, { color: colors.text }]}>{sec.title}</Text>
            </View>
            <Text style={[s.cardBody, { color: colors.textSecondary }]}>{sec.body}</Text>
          </View>
        ))}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={[s.footerText, { color: colors.textTertiary }]}>
            By using MAK, you agree to this privacy policy. We may update it from time to time and will notify you via email of significant changes.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 60 },
  hero: { alignItems: 'center', padding: 22, borderRadius: 18, borderWidth: 1, marginBottom: 20, gap: 8 },
  heroTitle: { fontSize: 18, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  heroBody: { fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 8 },
  heroDate: { fontSize: 11, marginTop: 6 },
  card: { padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconCircle: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  cardBody: { fontSize: 13, lineHeight: 20 },
  footer: { paddingTop: 16, paddingHorizontal: 8 },
  footerText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
