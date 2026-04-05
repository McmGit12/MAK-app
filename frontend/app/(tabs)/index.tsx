import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLastAnalysis = async () => {
    if (!user?.id) return;
    try {
      const analyses = await api.getUserAnalyses(user.id);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLastAnalysis();
    setRefreshing(false);
  };

  const features = [
    {
      icon: 'camera',
      title: 'Skin Analysis',
      description: 'Personalized skin assessment',
      route: '/(tabs)/analyze',
    },
    {
      icon: 'color-palette',
      title: 'Makeup Tips',
      description: 'Personalized recommendations',
      route: '/(tabs)/analyze',
    },
    {
      icon: 'sparkles',
      title: 'Skincare Routine',
      description: 'Custom daily routine',
      route: '/(tabs)/analyze',
    },
    {
      icon: 'heart',
      title: 'Beauty Goals',
      description: 'Track your progress',
      route: '/(tabs)/history',
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
          <View>
            <Text style={styles.greeting}>
              Welcome, {user?.display_name || (user?.login_method === 'guest' ? 'Guest' : 'Friend')}
            </Text>
            <Text style={styles.title}>MAK</Text>
            <Text style={styles.subtitle}>Your Personalized Makeup Buddy</Text>
          </View>
          <View style={styles.logoSmall}>
            <Ionicons name="sparkles" size={24} color="#D4AF37" />
          </View>
        </View>

        {/* Quick Action Card */}
        <TouchableOpacity
          style={styles.mainCard}
          onPress={() => router.push('/(tabs)/analyze')}
          activeOpacity={0.9}
        >
          <View style={styles.mainCardContent}>
            <View style={styles.mainCardIcon}>
              <Ionicons name="scan-outline" size={40} color="#D4AF37" />
            </View>
            <View style={styles.mainCardText}>
              <Text style={styles.mainCardTitle}>Start Skin Analysis</Text>
              <Text style={styles.mainCardSubtitle}>
                Take a photo and get personalized beauty recommendations
              </Text>
            </View>
          </View>
          <View style={styles.mainCardArrow}>
            <Ionicons name="arrow-forward" size={24} color="#D4AF37" />
          </View>
        </TouchableOpacity>

        {/* Last Analysis Summary */}
        {lastAnalysis && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Skin Profile</Text>
            <View style={styles.profileCard}>
              <View style={styles.profileRow}>
                <View style={styles.profileItem}>
                  <Text style={styles.profileLabel}>Skin Type</Text>
                  <Text style={styles.profileValue}>{lastAnalysis.skin_type}</Text>
                </View>
                <View style={styles.profileItem}>
                  <Text style={styles.profileLabel}>Tone</Text>
                  <Text style={styles.profileValue}>{lastAnalysis.skin_tone}</Text>
                </View>
              </View>
              <View style={styles.profileRow}>
                <View style={styles.profileItem}>
                  <Text style={styles.profileLabel}>Undertone</Text>
                  <Text style={styles.profileValue}>{lastAnalysis.undertone}</Text>
                </View>
                <View style={styles.profileItem}>
                  <Text style={styles.profileLabel}>Face Shape</Text>
                  <Text style={styles.profileValue}>{lastAnalysis.face_shape}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() => router.push({
                  pathname: '/analysis-result',
                  params: { analysisId: lastAnalysis.id }
                })}
              >
                <Text style={styles.viewDetailsText}>View Full Analysis</Text>
                <Ionicons name="chevron-forward" size={16} color="#D4AF37" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Features Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <TouchableOpacity
                key={index}
                style={styles.featureCard}
                onPress={() => router.push(feature.route as any)}
                activeOpacity={0.8}
              >
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon as any} size={24} color="#D4AF37" />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Beauty Tips</Text>
          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={24} color="#D4AF37" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Daily Skincare Tip</Text>
              <Text style={styles.tipText}>
                Always apply sunscreen as the last step of your morning skincare routine, even on cloudy days.
              </Text>
            </View>
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
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#888',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#D4AF37',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  logoSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  mainCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    marginBottom: 24,
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mainCardIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mainCardText: {
    flex: 1,
  },
  mainCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mainCardSubtitle: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  mainCardArrow: {
    alignSelf: 'flex-end',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  profileRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  profileItem: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  profileValue: {
    fontSize: 16,
    color: '#D4AF37',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.1)',
  },
  viewDetailsText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
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
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D4AF37',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#CCC',
    lineHeight: 20,
  },
});
