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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BEAUTY_TIPS = [
  {
    icon: 'sunny-outline',
    title: 'Sun Protection',
    text: 'Always apply SPF 30+ sunscreen as the last step of your morning routine, even on cloudy days.',
    color: '#F4A460',
  },
  {
    icon: 'water-outline',
    title: 'Hydration First',
    text: 'Drink 8 glasses of water daily. Hydrated skin absorbs products better and glows naturally.',
    color: '#87CEEB',
  },
  {
    icon: 'moon-outline',
    title: 'Night Routine',
    text: 'Never sleep with makeup on. Double cleanse at night to remove all traces of the day.',
    color: '#B19CD9',
  },
  {
    icon: 'leaf-outline',
    title: 'Natural Glow',
    text: 'Apply a vitamin C serum in the morning to brighten your complexion and fight free radicals.',
    color: '#90EE90',
  },
  {
    icon: 'heart-outline',
    title: 'Self Care',
    text: 'Use a face mask once a week to deeply nourish your skin and give yourself a pampering break.',
    color: '#FFB6C1',
  },
];

const BEAUTY_QUOTES = [
  { quote: "Beauty begins the moment you decide to be yourself.", author: "Coco Chanel" },
  { quote: "The best foundation you can wear is glowing, healthy skin.", author: "Beauty Wisdom" },
  { quote: "Invest in your skin. It is going to represent you for a long time.", author: "Linden Tyler" },
  { quote: "Nature gives you the face you have at twenty. Life shapes the face you have at thirty.", author: "Coco Chanel" },
  { quote: "Confidence is the best makeup any woman can wear.", author: "Beauty Wisdom" },
];

const TRENDING_CATEGORIES = [
  { icon: 'color-fill', label: 'Dewy Skin', color: '#87CEEB' },
  { icon: 'flower', label: 'Glass Skin', color: '#FFB6C1' },
  { icon: 'sparkles', label: 'No-Makeup Look', color: '#D4AF37' },
  { icon: 'brush', label: 'Bold Lips', color: '#FF6B6B' },
  { icon: 'eye', label: 'Smoky Eyes', color: '#B19CD9' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);
  const [analysesCount, setAnalysesCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  const tipScrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const todayQuote = BEAUTY_QUOTES[new Date().getDay() % BEAUTY_QUOTES.length];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getUserName = () => {
    if (user?.display_name) return user.display_name;
    if (user?.login_method === 'guest') return 'Guest';
    return 'Friend';
  };

  const getDaysSinceJoined = () => {
    if (!user?.created_at) return 0;
    const created = new Date(user.created_at);
    const now = new Date();
    return Math.max(1, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const fetchLastAnalysis = async () => {
    if (!user?.id) return;
    try {
      const analyses = await api.getUserAnalyses(user.id);
      setAnalysesCount(analyses.length);
      if (analyses.length > 0) {
        setLastAnalysis(analyses[0]);
      }
    } catch (err) {
      console.log('No analyses yet');
    }
  };

  useEffect(() => {
    fetchLastAnalysis();
  }, [user]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLastAnalysis();
    setRefreshing(false);
  };

  const handleTipScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 60));
    setActiveTipIndex(index);
  };

  const handleNotifyMe = () => {
    Alert.alert(
      'Stay Tuned!',
      'We\'ll notify you as soon as these exciting features are ready. Thank you for your interest!',
      [{ text: 'Sounds Great', style: 'default' }]
    );
  };

  const features = [
    {
      icon: 'scan-outline',
      title: 'Skin Analysis',
      description: 'Personalized skin assessment',
      route: '/(tabs)/analyze',
      accent: '#D4AF37',
    },
    {
      icon: 'color-palette',
      title: 'Makeup Match',
      description: 'Find your perfect shades',
      route: '/(tabs)/analyze',
      accent: '#FFB6C1',
    },
    {
      icon: 'sparkles',
      title: 'Skincare Routine',
      description: 'Custom daily routine',
      route: '/(tabs)/analyze',
      accent: '#87CEEB',
    },
    {
      icon: 'trending-up',
      title: 'Beauty Goals',
      description: 'Track your progress',
      route: '/(tabs)/history',
      accent: '#90EE90',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#D4AF37"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{getUserName()}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoSmall}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="person" size={20} color="#D4AF37" />
          </TouchableOpacity>
        </View>

        {/* Brand Banner */}
        <View style={styles.brandBanner}>
          <View style={styles.brandBannerLeft}>
            <View style={styles.brandLogoRow}>
              <Ionicons name="sparkles" size={20} color="#D4AF37" />
              <Text style={styles.brandName}>MAK</Text>
            </View>
            <Text style={styles.brandTagline}>Your Personalized Makeup Buddy</Text>
          </View>
          <View style={styles.brandDivider} />
          <View style={styles.brandBannerRight}>
            <Text style={styles.brandStatNumber}>{analysesCount}</Text>
            <Text style={styles.brandStatLabel}>Analyses</Text>
          </View>
        </View>

        {/* Quick Action Card */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.mainCard}
            onPress={() => router.push('/(tabs)/analyze')}
            activeOpacity={0.85}
          >
            <View style={styles.mainCardGlow} />
            <View style={styles.mainCardContent}>
              <View style={styles.mainCardIcon}>
                <Ionicons name="scan-outline" size={36} color="#D4AF37" />
              </View>
              <View style={styles.mainCardText}>
                <Text style={styles.mainCardTitle}>Start Skin Analysis</Text>
                <Text style={styles.mainCardSubtitle}>
                  Snap a photo for personalized beauty recommendations
                </Text>
              </View>
              <View style={styles.mainCardArrow}>
                <Ionicons name="arrow-forward-circle" size={32} color="#D4AF37" />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(212, 175, 55, 0.12)' }]}>
              <Ionicons name="analytics" size={20} color="#D4AF37" />
            </View>
            <Text style={styles.statNumber}>{analysesCount}</Text>
            <Text style={styles.statLabel}>Analyses</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(135, 206, 235, 0.12)' }]}>
              <Ionicons name="calendar" size={20} color="#87CEEB" />
            </View>
            <Text style={styles.statNumber}>{getDaysSinceJoined()}</Text>
            <Text style={styles.statLabel}>{getDaysSinceJoined() === 1 ? 'Day' : 'Days'}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(255, 182, 193, 0.12)' }]}>
              <Ionicons name="heart" size={20} color="#FFB6C1" />
            </View>
            <Text style={styles.statNumber}>{lastAnalysis ? '1' : '0'}</Text>
            <Text style={styles.statLabel}>Profile</Text>
          </View>
        </View>

        {/* Last Analysis Summary */}
        {lastAnalysis && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Skin Profile</Text>
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: '/analysis-result',
                  params: { analysisId: lastAnalysis.id }
                })}
              >
                <Text style={styles.seeAllText}>View Details</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.profileCard}>
              <View style={styles.profileGrid}>
                <View style={styles.profileGridItem}>
                  <View style={[styles.profileItemDot, { backgroundColor: '#D4AF37' }]} />
                  <Text style={styles.profileLabel}>Skin Type</Text>
                  <Text style={styles.profileValue}>{lastAnalysis.skin_type}</Text>
                </View>
                <View style={styles.profileGridItem}>
                  <View style={[styles.profileItemDot, { backgroundColor: '#FFB6C1' }]} />
                  <Text style={styles.profileLabel}>Tone</Text>
                  <Text style={styles.profileValue}>{lastAnalysis.skin_tone}</Text>
                </View>
                <View style={styles.profileGridItem}>
                  <View style={[styles.profileItemDot, { backgroundColor: '#87CEEB' }]} />
                  <Text style={styles.profileLabel}>Undertone</Text>
                  <Text style={styles.profileValue}>{lastAnalysis.undertone}</Text>
                </View>
                <View style={styles.profileGridItem}>
                  <View style={[styles.profileItemDot, { backgroundColor: '#90EE90' }]} />
                  <Text style={styles.profileLabel}>Face Shape</Text>
                  <Text style={styles.profileValue}>{lastAnalysis.face_shape}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Trending Now */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trending Now</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingScroll}
          >
            {TRENDING_CATEGORIES.map((cat, index) => (
              <TouchableOpacity
                key={index}
                style={styles.trendingChip}
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/analyze')}
              >
                <View style={[styles.trendingChipIcon, { backgroundColor: `${cat.color}20` }]}>
                  <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                </View>
                <Text style={styles.trendingChipLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Features Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <TouchableOpacity
                key={index}
                style={styles.featureCard}
                onPress={() => router.push(feature.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.featureIcon, { backgroundColor: `${feature.accent}15` }]}>
                  <Ionicons name={feature.icon as any} size={24} color={feature.accent} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
                <View style={styles.featureArrow}>
                  <Ionicons name="chevron-forward" size={14} color="#666" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Beauty Tips Carousel */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Beauty Tips</Text>
            <View style={styles.tipDots}>
              {BEAUTY_TIPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.tipDot,
                    activeTipIndex === i && styles.tipDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
          <ScrollView
            ref={tipScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleTipScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH - 40}
            contentContainerStyle={{ paddingRight: 20 }}
          >
            {BEAUTY_TIPS.map((tip, index) => (
              <View key={index} style={[styles.tipCard, { width: SCREEN_WIDTH - 60 }]}>
                <View style={[styles.tipIconCircle, { backgroundColor: `${tip.color}20` }]}>
                  <Ionicons name={tip.icon as any} size={24} color={tip.color} />
                </View>
                <View style={styles.tipContent}>
                  <Text style={[styles.tipTitle, { color: tip.color }]}>{tip.title}</Text>
                  <Text style={styles.tipText}>{tip.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Inspiration Quote */}
        <View style={styles.section}>
          <View style={styles.quoteCard}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#D4AF37" style={styles.quoteIcon} />
            <Text style={styles.quoteText}>"{todayQuote.quote}"</Text>
            <Text style={styles.quoteAuthor}>— {todayQuote.author}</Text>
          </View>
        </View>

        {/* Coming Soon Section */}
        <View style={styles.section}>
          <View style={styles.comingSoonHeader}>
            <View style={styles.comingSoonBadge}>
              <Ionicons name="rocket" size={14} color="#0D0D0D" />
              <Text style={styles.comingSoonBadgeText}>COMING SOON</Text>
            </View>
            <View style={styles.comingSoonLine} />
          </View>

          {/* Recent Activity Card */}
          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonCardInner}>
              <View style={styles.comingSoonIconContainer}>
                <Ionicons name="notifications" size={24} color="#D4AF37" />
              </View>
              <View style={styles.comingSoonContent}>
                <Text style={styles.comingSoonTitle}>Recent Activity Notes</Text>
                <Text style={styles.comingSoonDescription}>
                  Personalized notes about your beauty journey milestones and analysis insights.
                </Text>
              </View>
            </View>
            <View style={styles.comingSoonFeatures}>
              <View style={styles.comingSoonFeatureItem}>
                <View style={styles.comingSoonCheckCircle}>
                  <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                </View>
                <Text style={styles.comingSoonFeatureText}>Daily beauty insights</Text>
              </View>
              <View style={styles.comingSoonFeatureItem}>
                <View style={styles.comingSoonCheckCircle}>
                  <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                </View>
                <Text style={styles.comingSoonFeatureText}>Progress milestones</Text>
              </View>
              <View style={styles.comingSoonFeatureItem}>
                <View style={styles.comingSoonCheckCircle}>
                  <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                </View>
                <Text style={styles.comingSoonFeatureText}>Personalized reminders</Text>
              </View>
            </View>
          </View>

          {/* Favorites Card */}
          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonCardInner}>
              <View style={[styles.comingSoonIconContainer, { backgroundColor: 'rgba(255, 182, 193, 0.15)' }]}>
                <Ionicons name="heart" size={24} color="#FFB6C1" />
              </View>
              <View style={styles.comingSoonContent}>
                <Text style={styles.comingSoonTitle}>Set Your Favorites</Text>
                <Text style={styles.comingSoonDescription}>
                  Save favorite products, routines, and recommendations for quick access.
                </Text>
              </View>
            </View>
            <View style={styles.comingSoonFeatures}>
              <View style={styles.comingSoonFeatureItem}>
                <View style={[styles.comingSoonCheckCircle, { backgroundColor: '#FFB6C1' }]}>
                  <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                </View>
                <Text style={styles.comingSoonFeatureText}>Favorite products collection</Text>
              </View>
              <View style={styles.comingSoonFeatureItem}>
                <View style={[styles.comingSoonCheckCircle, { backgroundColor: '#FFB6C1' }]}>
                  <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                </View>
                <Text style={styles.comingSoonFeatureText}>Custom beauty routines</Text>
              </View>
              <View style={styles.comingSoonFeatureItem}>
                <View style={[styles.comingSoonCheckCircle, { backgroundColor: '#FFB6C1' }]}>
                  <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                </View>
                <Text style={styles.comingSoonFeatureText}>Smart recommendations</Text>
              </View>
            </View>
          </View>

          {/* Community Card */}
          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonCardInner}>
              <View style={[styles.comingSoonIconContainer, { backgroundColor: 'rgba(135, 206, 235, 0.15)' }]}>
                <Ionicons name="people" size={24} color="#87CEEB" />
              </View>
              <View style={styles.comingSoonContent}>
                <Text style={styles.comingSoonTitle}>Beauty Community</Text>
                <Text style={styles.comingSoonDescription}>
                  Connect with others, share tips, and discover new beauty trends together.
                </Text>
              </View>
            </View>
            <View style={styles.comingSoonFeatures}>
              <View style={styles.comingSoonFeatureItem}>
                <View style={[styles.comingSoonCheckCircle, { backgroundColor: '#87CEEB' }]}>
                  <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                </View>
                <Text style={styles.comingSoonFeatureText}>Share beauty looks</Text>
              </View>
              <View style={styles.comingSoonFeatureItem}>
                <View style={[styles.comingSoonCheckCircle, { backgroundColor: '#87CEEB' }]}>
                  <Ionicons name="checkmark" size={10} color="#0D0D0D" />
                </View>
                <Text style={styles.comingSoonFeatureText}>Expert Q&A sessions</Text>
              </View>
            </View>
          </View>

          {/* Notify Me Button */}
          <TouchableOpacity style={styles.notifyButton} activeOpacity={0.8} onPress={handleNotifyMe}>
            <Ionicons name="notifications-outline" size={20} color="#0D0D0D" />
            <Text style={styles.notifyButtonText}>Notify Me When Available</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>Made with love for your beauty journey</Text>
          <View style={styles.footerBrand}>
            <Ionicons name="sparkles" size={14} color="#D4AF37" />
            <Text style={styles.footerBrandText}>MAK v1.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 0.3,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  logoSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  // Brand Banner
  brandBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  brandBannerLeft: {
    flex: 1,
  },
  brandLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D4AF37',
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  brandDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    marginHorizontal: 16,
  },
  brandBannerRight: {
    alignItems: 'center',
    minWidth: 56,
  },
  brandStatNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#D4AF37',
  },
  brandStatLabel: {
    fontSize: 10,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Main CTA Card
  mainCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  mainCardGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  mainCardText: {
    flex: 1,
  },
  mainCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mainCardSubtitle: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  mainCardArrow: {
    marginLeft: 8,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  seeAllText: {
    fontSize: 13,
    color: '#D4AF37',
    fontWeight: '600',
    marginBottom: 14,
  },
  // Skin Profile
  profileCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profileGridItem: {
    width: '47%',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    borderRadius: 12,
    padding: 14,
  },
  profileItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  profileLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileValue: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  // Trending
  trendingScroll: {
    paddingBottom: 4,
    gap: 10,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  trendingChipIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingChipLabel: {
    fontSize: 13,
    color: '#CCC',
    fontWeight: '500',
  },
  // Features
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  featureArrow: {
    position: 'absolute',
    top: 16,
    right: 14,
  },
  // Tips Carousel
  tipDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  tipDotActive: {
    backgroundColor: '#D4AF37',
    width: 18,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tipIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    color: '#999',
    lineHeight: 19,
  },
  // Quote
  quoteCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
  },
  quoteIcon: {
    marginBottom: 12,
  },
  quoteText: {
    fontSize: 15,
    color: '#CCC',
    fontStyle: 'italic',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  quoteAuthor: {
    fontSize: 12,
    color: '#D4AF37',
    fontWeight: '600',
  },
  // Coming Soon
  comingSoonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  comingSoonBadgeText: {
    color: '#0D0D0D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  comingSoonLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  comingSoonCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  comingSoonCardInner: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  comingSoonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  comingSoonContent: {
    flex: 1,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  comingSoonDescription: {
    fontSize: 13,
    color: '#888',
    lineHeight: 19,
  },
  comingSoonFeatures: {
    gap: 8,
    paddingLeft: 62,
  },
  comingSoonFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comingSoonCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonFeatureText: {
    fontSize: 12,
    color: '#AAA',
  },
  // Notify Button
  notifyButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  notifyButtonText: {
    color: '#0D0D0D',
    fontSize: 15,
    fontWeight: '700',
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  footerDivider: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 1,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#555',
    marginBottom: 8,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerBrandText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
});
