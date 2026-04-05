import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';

interface Analysis {
  id: string;
  skin_type: string;
  skin_tone: string;
  undertone: string;
  face_shape: string;
  skin_concerns: string[];
  texture_analysis: string;
  ai_recommendations: Array<{
    category: string;
    recommendation: string;
    shade_range?: string;
    tips: string;
    reason: string;
  }>;
  created_at: string;
}

interface CuratedRecommendation {
  id: string;
  category: string;
  product_name: string;
  brand: string;
  description: string;
  tips: string;
}

export default function AnalysisResultScreen() {
  const router = useRouter();
  const { analysisId } = useLocalSearchParams();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [curatedRecs, setCuratedRecs] = useState<CuratedRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ai' | 'curated'>('ai');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (analysisId) {
          const analysisData = await api.getAnalysis(analysisId as string);
          setAnalysis(analysisData);

          // Fetch curated recommendations based on skin type and tone
          const curated = await api.getCuratedRecommendations(
            analysisData.skin_type,
            analysisData.skin_tone
          );
          setCuratedRecs(curated);
        }
      } catch (err) {
        console.error('Error fetching analysis:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [analysisId]);

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      foundation: 'color-fill',
      concealer: 'brush',
      blush: 'heart',
      lipstick: 'color-palette',
      skincare: 'water',
      primer: 'layers',
      eyeshadow: 'eye',
      mascara: 'eye-outline',
    };
    return icons[category.toLowerCase()] || 'sparkles';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={styles.loadingText}>Loading your results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analysis) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
          <Text style={styles.errorText}>Failed to load analysis</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analysis Results</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Skin Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Ionicons name="sparkles" size={24} color="#D4AF37" />
            <Text style={styles.profileTitle}>Your Skin Profile</Text>
          </View>

          <View style={styles.profileGrid}>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Skin Type</Text>
              <Text style={styles.profileValue}>{analysis.skin_type}</Text>
            </View>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Skin Tone</Text>
              <Text style={styles.profileValue}>{analysis.skin_tone}</Text>
            </View>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Undertone</Text>
              <Text style={styles.profileValue}>{analysis.undertone}</Text>
            </View>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Face Shape</Text>
              <Text style={styles.profileValue}>{analysis.face_shape}</Text>
            </View>
          </View>

          {/* Skin Concerns */}
          {analysis.skin_concerns.length > 0 && (
            <View style={styles.concernsSection}>
              <Text style={styles.concernsLabel}>Areas to Focus On</Text>
              <View style={styles.concernsTags}>
                {analysis.skin_concerns.map((concern, index) => (
                  <View key={index} style={styles.concernTag}>
                    <Text style={styles.concernTagText}>{concern}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Texture Analysis */}
          {analysis.texture_analysis && (
            <View style={styles.textureSection}>
              <Text style={styles.textureLabel}>Texture Analysis</Text>
              <Text style={styles.textureText}>{analysis.texture_analysis}</Text>
            </View>
          )}
        </View>

        {/* Recommendations Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ai' && styles.activeTab]}
            onPress={() => setActiveTab('ai')}
          >
            <Ionicons
              name="sparkles"
              size={18}
              color={activeTab === 'ai' ? '#D4AF37' : '#888'}
            />
            <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>
              For You
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'curated' && styles.activeTab]}
            onPress={() => setActiveTab('curated')}
          >
            <Ionicons
              name="star"
              size={18}
              color={activeTab === 'curated' ? '#D4AF37' : '#888'}
            />
            <Text style={[styles.tabText, activeTab === 'curated' && styles.activeTabText]}>
              Expert Picks
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recommendations List */}
        <View style={styles.recommendationsSection}>
          {activeTab === 'ai' ? (
            analysis.ai_recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationCard}>
                <View style={styles.recHeader}>
                  <View style={styles.recIcon}>
                    <Ionicons
                      name={getCategoryIcon(rec.category) as any}
                      size={22}
                      color="#D4AF37"
                    />
                  </View>
                  <View style={styles.recHeaderText}>
                    <Text style={styles.recCategory}>{rec.category}</Text>
                    <Text style={styles.recTitle}>{rec.recommendation}</Text>
                  </View>
                </View>

                {rec.shade_range && rec.shade_range !== 'N/A' && (
                  <View style={styles.recDetail}>
                    <Text style={styles.recDetailLabel}>Shade Range</Text>
                    <Text style={styles.recDetailValue}>{rec.shade_range}</Text>
                  </View>
                )}

                <View style={styles.recDetail}>
                  <Text style={styles.recDetailLabel}>Application Tips</Text>
                  <Text style={styles.recDetailValue}>{rec.tips}</Text>
                </View>

                <View style={styles.recReason}>
                  <Ionicons name="bulb" size={16} color="#D4AF37" />
                  <Text style={styles.recReasonText}>{rec.reason}</Text>
                </View>
              </View>
            ))
          ) : (
            curatedRecs.map((rec, index) => (
              <View key={index} style={styles.recommendationCard}>
                <View style={styles.recHeader}>
                  <View style={styles.recIcon}>
                    <Ionicons
                      name={getCategoryIcon(rec.category) as any}
                      size={22}
                      color="#D4AF37"
                    />
                  </View>
                  <View style={styles.recHeaderText}>
                    <Text style={styles.recCategory}>{rec.category}</Text>
                    <Text style={styles.recTitle}>{rec.product_name}</Text>
                  </View>
                </View>

                <View style={styles.recDetail}>
                  <Text style={styles.recDetailValue}>{rec.description}</Text>
                </View>

                <View style={styles.recReason}>
                  <Ionicons name="bulb" size={16} color="#D4AF37" />
                  <Text style={styles.recReasonText}>{rec.tips}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.newAnalysisButton}
          onPress={() => router.push('/(tabs)/analyze')}
        >
          <Ionicons name="camera" size={22} color="#0D0D0D" />
          <Text style={styles.newAnalysisText}>New Analysis</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.1)',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
  },
  backButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#0D0D0D',
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  profileItem: {
    width: '47%',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 12,
    padding: 14,
  },
  profileLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  profileValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D4AF37',
    textTransform: 'capitalize',
  },
  concernsSection: {
    marginBottom: 16,
  },
  concernsLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
  },
  concernsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  concernTag: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  concernTagText: {
    fontSize: 12,
    color: '#FF9999',
    textTransform: 'capitalize',
  },
  textureSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.1)',
    paddingTop: 16,
  },
  textureLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  textureText: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 22,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  activeTabText: {
    color: '#D4AF37',
  },
  recommendationsSection: {
    gap: 16,
    marginBottom: 24,
  },
  recommendationCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  recIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recHeaderText: {
    flex: 1,
  },
  recCategory: {
    fontSize: 11,
    color: '#D4AF37',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  recTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recDetail: {
    marginBottom: 12,
  },
  recDetailLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  recDetailValue: {
    fontSize: 13,
    color: '#CCC',
    lineHeight: 20,
  },
  recReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    padding: 12,
    borderRadius: 10,
  },
  recReasonText: {
    flex: 1,
    fontSize: 12,
    color: '#D4AF37',
    lineHeight: 18,
  },
  newAnalysisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#D4AF37',
    borderRadius: 14,
    padding: 16,
  },
  newAnalysisText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D0D0D',
  },
});
