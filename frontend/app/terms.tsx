import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';

const SECTIONS: { title: string; body: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    icon: 'sparkles-outline',
    title: 'What MAK is',
    body: 'MAK — Your Personalized Makeup Buddy is a free mobile app that uses AI to analyze your skin from a selfie and suggest personalized skincare, makeup, and travel styling tips. It is a beauty assistant, not a medical service.',
  },
  {
    icon: 'person-outline',
    title: 'Using your account',
    body: 'You agree to provide accurate information when creating an account and to keep your password confidential. You are responsible for all activity that happens under your account. If you suspect unauthorized access, contact us immediately.',
  },
  {
    icon: 'image-outline',
    title: 'Photos you upload',
    body: 'You retain full ownership of any photo you upload. By uploading, you grant MAK a limited, revocable license to process that photo solely for the purpose of generating your analysis. We do not use your photos to train AI models, do not share them, and do not display them to anyone other than you.',
  },
  {
    icon: 'medkit-outline',
    title: 'Not medical advice',
    body: 'Skin and makeup recommendations are for cosmetic and informational purposes only. They are NOT a substitute for advice from a licensed dermatologist or healthcare professional. If you experience any irritation, allergic reaction, or skin concern, stop using the recommended product and consult a doctor.',
  },
  {
    icon: 'shield-outline',
    title: 'Acceptable use',
    body: 'You agree NOT to: (a) upload images of anyone without their consent, (b) upload images of minors under 13, (c) upload non-facial or inappropriate content, (d) attempt to reverse-engineer or scrape the service, (e) use MAK for any commercial purpose without our written permission, or (f) impersonate another person.',
  },
  {
    icon: 'bag-outline',
    title: 'Product recommendations',
    body: 'AI-suggested products and shades are guidance only. We do not guarantee availability, pricing, or suitability for your specific skin type or allergies. Always patch-test new products and read labels before use. MAK is not responsible for purchases made based on recommendations.',
  },
  {
    icon: 'close-circle-outline',
    title: 'Termination',
    body: 'You may delete your account at any time from Profile → Delete Account, which permanently removes your data within 7 days. We reserve the right to suspend accounts that violate these terms, and will notify you by email when we do.',
  },
  {
    icon: 'warning-outline',
    title: 'Limitation of liability',
    body: 'MAK is provided “as is” without warranties of any kind. To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the app, including but not limited to skin reactions to recommended products, photo upload failures, or AI inaccuracies.',
  },
  {
    icon: 'document-text-outline',
    title: 'Changes to these terms',
    body: 'We may update these Terms from time to time. When we do, we will update the “Last updated” date below and — for material changes — notify you by email. Continued use of the app after a change means you accept the updated Terms.',
  },
  {
    icon: 'mail-outline',
    title: 'Contact us',
    body: 'If you have questions about these Terms, email us at makstylingbuddy.support@gmail.com. We respond within 5 business days.',
  },
];

export default function TermsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Terms of Service</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}>
          <Ionicons name="document-text" size={36} color={colors.primary} />
          <Text style={[s.heroTitle, { color: colors.text }]}>Welcome to MAK</Text>
          <Text style={[s.heroBody, { color: colors.textSecondary }]}>
            These are the rules that keep MAK fair, safe, and pleasant for everyone. Please read them carefully.
          </Text>
          <Text style={[s.heroDate, { color: colors.textTertiary }]}>Last updated: 14 February 2026</Text>
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
            By creating an account or using MAK, you confirm that you have read and agreed to these Terms of Service and our Privacy Policy.
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
