import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BEAUTY_TIPS = [
  { icon: 'sunny-outline', title: 'Sun Protection', text: 'Always apply SPF 30+ sunscreen as the last step of your morning routine, even on cloudy days.', color: '#E8A87C' },
  { icon: 'water-outline', title: 'Hydration First', text: 'Drink 8 glasses of water daily. Hydrated skin absorbs products better and glows naturally.', color: '#7CC5B2' },
  { icon: 'moon-outline', title: 'Night Routine', text: 'Never sleep with makeup on. Double cleanse at night to remove all traces of the day.', color: '#A98EC4' },
  { icon: 'leaf-outline', title: 'Natural Glow', text: 'Apply a vitamin C serum in the morning to brighten your complexion and fight free radicals.', color: '#90C695' },
  { icon: 'heart-outline', title: 'Self Care', text: 'Use a face mask once a week to deeply nourish your skin and give yourself a pampering break.', color: '#D4849A' },
];

const BEAUTY_QUOTES = [
  { quote: "Beauty begins the moment you decide to be yourself.", author: "Coco Chanel" },
  { quote: "The best foundation you can wear is glowing, healthy skin.", author: "Beauty Wisdom" },
  { quote: "Invest in your skin. It is going to represent you for a long time.", author: "Linden Tyler" },
  { quote: "Nature gives you the face you have at twenty. Life shapes the face you have at thirty.", author: "Coco Chanel" },
  { quote: "Confidence is the best makeup any woman can wear.", author: "Beauty Wisdom" },
];

const TRENDING = [
  { icon: 'color-fill', label: 'Dewy Skin', color: '#7CC5B2' },
  { icon: 'flower', label: 'Glass Skin', color: '#D4849A' },
  { icon: 'sparkles', label: 'No-Makeup Look', color: '#C9946A' },
  { icon: 'brush', label: 'Bold Lips', color: '#E85D75' },
  { icon: 'eye', label: 'Smoky Eyes', color: '#A98EC4' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);
  const [analysesCount, setAnalysesCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const waveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const todayQuote = BEAUTY_QUOTES[new Date().getDay() % BEAUTY_QUOTES.length];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getUserName = () => {
    if (user?.display_name) return user.display_name;
    if (user?.login_method === 'guest') return 'Guest';
    return 'Friend';
  };

  const getDaysSinceJoined = () => {
    if (!user?.created_at) return 1;
    const created = new Date(user.created_at);
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const fetchData = async () => {
    if (!user?.id) { setPageLoading(false); return; }
    try {
      const analyses = await api.getUserAnalyses(user.id);
      setAnalysesCount(analyses.length);
      if (analyses.length > 0) setLastAnalysis(analyses[0]);
    } catch (err) {
      console.log('No analyses yet');
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  // Wave animation
  useEffect(() => {
    const wave = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(3000),
      ])
    );
    wave.start();
    return () => wave.stop();
  }, []);

  // Pulse animation for CTA
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const waveRotate = waveAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '20deg'] });

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const handleTipScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 60));
    setActiveTipIndex(idx);
  };

  const handleNotifyMe = () => {
    Alert.alert('Stay Tuned!', 'We\'ll notify you as soon as these exciting features are ready!', [{ text: 'Sounds Great' }]);
  };

  const features = [
    { icon: 'scan-outline', title: 'Skin Analysis', desc: 'Personalized skin assessment', route: '/(tabs)/analyze', accent: colors.primary },
    { icon: 'color-palette', title: 'Makeup Match', desc: 'Find your perfect shades', route: '/(tabs)/analyze', accent: colors.secondary },
    { icon: 'sparkles', title: 'Skincare Routine', desc: 'Custom daily routine', route: '/(tabs)/analyze', accent: colors.tertiary },
    { icon: 'trending-up', title: 'Beauty Goals', desc: 'Track your progress', route: '/(tabs)/history', accent: colors.accent },
  ];

  if (pageLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your beauty dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.greetingRow}>
            <View>
              <View style={styles.greetingLine}>
                <Text style={[styles.greeting, { color: colors.textSecondary }]}>{getGreeting()},</Text>
                <Animated.Text style={[styles.waveEmoji, { transform: [{ rotate: waveRotate }] }]}>
                  {'\u{1F44B}'}
                </Animated.Text>
              </View>
              <Text style={[styles.userName, { color: colors.text }]}>{getUserName()}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={isDark ? '#F4A460' : '#A98EC4'} />
          </TouchableOpacity>
        </View>

        {/* Centered MAK Branding */}
        <View style={styles.brandCenter}>
          <View style={styles.brandLogoRow}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={[styles.brandName, { color: colors.primary }]}>MAK</Text>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>Your Personalized Makeup Buddy</Text>
        </View>

        {/* Main CTA */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/analyze')}
            activeOpacity={0.85}
          >
            <View style={[styles.mainCardIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="scan-outline" size={32} color={colors.primary} />
            </View>
            <View style={styles.mainCardText}>
              <Text style={[styles.mainCardTitle, { color: colors.text }]}>Start Skin Analysis</Text>
              <Text style={[styles.mainCardSubtitle, { color: colors.textSecondary }]}>Snap a photo for personalized beauty recommendations</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          {[
            { icon: 'analytics', num: analysesCount, label: 'Analyses', c: colors.primary, bg: colors.primaryLight },
            { icon: 'calendar', num: getDaysSinceJoined(), label: getDaysSinceJoined() === 1 ? 'Day' : 'Days', c: colors.secondary, bg: colors.secondaryLight },
            { icon: 'heart', num: lastAnalysis ? 1 : 0, label: 'Profile', c: colors.tertiary, bg: colors.tertiaryLight },
          ].map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={[styles.statIconBg, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon as any} size={18} color={s.c} />
              </View>
              <Text style={[styles.statNumber, { color: colors.text }]}>{s.num}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Skin Profile */}
        {lastAnalysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Skin Profile</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/analysis-result', params: { analysisId: lastAnalysis.id } })}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>View Details</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={styles.profileGrid}>
                {[
                  { label: 'Skin Type', value: lastAnalysis.skin_type, c: colors.primary },
                  { label: 'Tone', value: lastAnalysis.skin_tone, c: colors.secondary },
                  { label: 'Undertone', value: lastAnalysis.undertone, c: colors.tertiary },
                  { label: 'Face Shape', value: lastAnalysis.face_shape, c: colors.accent },
                ].map((p, i) => (
                  <View key={i} style={[styles.profileGridItem, { backgroundColor: colors.surfaceVariant }]}>
                    <View style={[styles.profileDot, { backgroundColor: p.c }]} />
                    <Text style={[styles.profileLabel, { color: colors.textSecondary }]}>{p.label}</Text>
                    <Text style={[styles.profileValue, { color: colors.text }]}>{p.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Trending */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending Now</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingScroll}>
            {TRENDING.map((t, i) => (
              <TouchableOpacity key={i} style={[styles.trendingChip, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} activeOpacity={0.7} onPress={() => router.push({ pathname: '/(tabs)/analyze', params: { trendMode: 'makeup', trendLabel: t.label } })}>
                <View style={[styles.trendingChipIcon, { backgroundColor: `${t.color}20` }]}>
                  <Ionicons name={t.icon as any} size={16} color={t.color} />
                </View>
                <Text style={[styles.trendingChipLabel, { color: colors.text }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Explore</Text>
          <View style={styles.featuresGrid}>
            {features.map((f, i) => (
              <TouchableOpacity key={i} style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={() => router.push(f.route as any)} activeOpacity={0.8}>
                <View style={[styles.featureIcon, { backgroundColor: `${f.accent}18` }]}>
                  <Ionicons name={f.icon as any} size={22} color={f.accent} />
                </View>
                <Text style={[styles.featureTitle, { color: colors.text }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{f.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Beauty Tips Carousel */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Beauty Tips</Text>
            <View style={styles.tipDots}>
              {BEAUTY_TIPS.map((_, i) => (
                <View key={i} style={[styles.tipDot, { backgroundColor: colors.borderLight }, activeTipIndex === i && { backgroundColor: colors.primary, width: 16 }]} />
              ))}
            </View>
          </View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={handleTipScroll} scrollEventThrottle={16} decelerationRate="fast" snapToInterval={SCREEN_WIDTH - 40} contentContainerStyle={{ paddingRight: 20 }}>
            {BEAUTY_TIPS.map((tip, i) => (
              <View key={i} style={[styles.tipCard, { width: SCREEN_WIDTH - 60, backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <View style={[styles.tipIconCircle, { backgroundColor: `${tip.color}20` }]}>
                  <Ionicons name={tip.icon as any} size={22} color={tip.color} />
                </View>
                <View style={styles.tipContent}>
                  <Text style={[styles.tipTitle, { color: tip.color }]}>{tip.title}</Text>
                  <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Quote */}
        <View style={styles.section}>
          <View style={[styles.quoteCard, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} />
            <Text style={[styles.quoteText, { color: colors.text }]}>"{todayQuote.quote}"</Text>
            <Text style={[styles.quoteAuthor, { color: colors.primary }]}>— {todayQuote.author}</Text>
          </View>
        </View>

        {/* Coming Soon */}
        <View style={styles.section}>
          <View style={styles.comingSoonHeader}>
            <View style={[styles.comingSoonBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="rocket" size={13} color="#FFF" />
              <Text style={styles.comingSoonBadgeText}>COMING SOON</Text>
            </View>
            <View style={[styles.comingSoonLine, { backgroundColor: colors.border }]} />
          </View>

          {[
            { icon: 'notifications', title: 'Recent Activity Notes', desc: 'Personalized notes about your beauty journey.', ic: colors.primary, bg: colors.primaryLight, items: ['Daily beauty insights', 'Progress milestones', 'Personalized reminders'] },
            { icon: 'heart', title: 'Set Your Favorites', desc: 'Save favorite products and routines.', ic: colors.secondary, bg: colors.secondaryLight, items: ['Favorite products', 'Custom routines', 'Smart recommendations'] },
            { icon: 'people', title: 'Beauty Community', desc: 'Connect, share tips, discover trends.', ic: colors.tertiary, bg: colors.tertiaryLight, items: ['Share beauty looks', 'Expert Q&A sessions'] },
          ].map((card, ci) => (
            <View key={ci} style={[styles.comingSoonCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <View style={styles.comingSoonCardInner}>
                <View style={[styles.comingSoonIconBg, { backgroundColor: card.bg }]}>
                  <Ionicons name={card.icon as any} size={22} color={card.ic} />
                </View>
                <View style={styles.comingSoonContent}>
                  <Text style={[styles.comingSoonTitle, { color: colors.text }]}>{card.title}</Text>
                  <Text style={[styles.comingSoonDesc, { color: colors.textSecondary }]}>{card.desc}</Text>
                </View>
              </View>
              <View style={styles.comingSoonItems}>
                {card.items.map((item, ii) => (
                  <View key={ii} style={styles.comingSoonItem}>
                    <View style={[styles.checkCircle, { backgroundColor: card.ic }]}>
                      <Ionicons name="checkmark" size={10} color="#FFF" />
                    </View>
                    <Text style={[styles.comingSoonItemText, { color: colors.textSecondary }]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={[styles.notifyBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8} onPress={handleNotifyMe}>
            <Ionicons name="notifications-outline" size={18} color="#FFF" />
            <Text style={styles.notifyBtnText}>Notify Me When Available</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={[styles.footerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>Made with love for your beauty journey</Text>
          <View style={styles.footerBrand}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
            <Text style={[styles.footerBrandText, { color: colors.textTertiary }]}>MAK v1.0</Text>
          </View>
          <View style={styles.footerDisclaimer}>
            <Ionicons name="shield-checkmark-outline" size={12} color={colors.textTertiary} />
            <Text style={[styles.footerDisclaimerText, { color: colors.textTertiary }]}>We respect your privacy and do not store any personal data. Try recommendations at your own discretion.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14 },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greetingRow: { flex: 1 },
  greetingLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greeting: { fontSize: 14, letterSpacing: 0.3 },
  waveEmoji: { fontSize: 20 },
  userName: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  themeToggle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  // Brand
  brandCenter: { alignItems: 'center', marginBottom: 20 },
  brandLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 26, fontWeight: '800', letterSpacing: 3 },
  brandTagline: { fontSize: 12, marginTop: 4 },
  // Main CTA
  mainCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 20 },
  mainCardIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  mainCardText: { flex: 1 },
  mainCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  mainCardSubtitle: { fontSize: 12, lineHeight: 17 },
  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1 },
  statIconBg: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statNumber: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },
  // Section
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  seeAll: { fontSize: 13, fontWeight: '600', marginBottom: 14 },
  // Profile
  profileCard: { borderRadius: 16, padding: 14, borderWidth: 1 },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  profileGridItem: { width: '47%', borderRadius: 12, padding: 14 },
  profileDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  profileLabel: { fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileValue: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  // Trending
  trendingScroll: { paddingBottom: 4, gap: 10 },
  trendingChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, gap: 8 },
  trendingChipIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  trendingChipLabel: { fontSize: 13, fontWeight: '500' },
  // Features
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { width: '48%', borderRadius: 16, padding: 16, borderWidth: 1 },
  featureIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  featureTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  featureDesc: { fontSize: 12, lineHeight: 16 },
  // Tips
  tipDots: { flexDirection: 'row', gap: 5, marginBottom: 14 },
  tipDot: { width: 6, height: 6, borderRadius: 3 },
  tipCard: { flexDirection: 'row', borderRadius: 16, padding: 16, marginRight: 12, borderWidth: 1 },
  tipIconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  tipText: { fontSize: 13, lineHeight: 19 },
  // Quote
  quoteCard: { borderRadius: 16, padding: 20, borderWidth: 1, alignItems: 'center' },
  quoteText: { fontSize: 15, fontStyle: 'italic', lineHeight: 24, textAlign: 'center', marginVertical: 8 },
  quoteAuthor: { fontSize: 12, fontWeight: '600' },
  // Coming Soon
  comingSoonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  comingSoonBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  comingSoonBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  comingSoonLine: { flex: 1, height: 1 },
  comingSoonCard: { borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1 },
  comingSoonCardInner: { flexDirection: 'row', marginBottom: 14 },
  comingSoonIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  comingSoonContent: { flex: 1 },
  comingSoonTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  comingSoonDesc: { fontSize: 12, lineHeight: 18 },
  comingSoonItems: { gap: 8, paddingLeft: 58 },
  comingSoonItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkCircle: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  comingSoonItemText: { fontSize: 12 },
  notifyBtn: { borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 },
  notifyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  // Footer
  footer: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  footerLine: { width: 40, height: 2, borderRadius: 1, marginBottom: 16 },
  footerText: { fontSize: 12, marginBottom: 8 },
  footerBrand: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerBrandText: { fontSize: 11, fontWeight: '600' },
  footerDisclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 10, paddingHorizontal: 16 },
  footerDisclaimerText: { flex: 1, fontSize: 9, lineHeight: 14, textAlign: 'center' },
});
