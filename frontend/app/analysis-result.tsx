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
import { useTheme } from '../src/context/ThemeContext';
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
  const { colors } = useTheme();
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
          const curated = await api.getCuratedRecommendations(analysisData.skin_type, analysisData.skin_tone);
          setCuratedRecs(curated);
        }
      } catch (err) { console.error('Error fetching analysis:', err); } finally { setLoading(false); }
    };
    fetchData();
  }, [analysisId]);

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      foundation: 'color-fill', concealer: 'brush', blush: 'heart',
      lipstick: 'color-palette', skincare: 'water', primer: 'layers',
      eyeshadow: 'eye', mascara: 'eye-outline',
    };
    return icons[category.toLowerCase()] || 'sparkles';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analysis) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>Failed to load analysis</Text>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Analysis Results</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.profileHeader}>
            <Ionicons name="sparkles" size={24} color={colors.primary} />
            <Text style={[styles.profileTitle, { color: colors.text }]}>Your Skin Profile</Text>
          </View>
          <View style={styles.profileGrid}>
            {[
              { label: 'Skin Type', value: analysis.skin_type },
              { label: 'Skin Tone', value: analysis.skin_tone },
              { label: 'Undertone', value: analysis.undertone },
              { label: 'Face Shape', value: analysis.face_shape },
            ].map((item, i) => (
              <View key={i} style={[styles.profileItem, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.profileLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.profileValue, { color: colors.primary }]}>{item.value}</Text>
              </View>
            ))}
          </View>
          {analysis.skin_concerns && analysis.skin_concerns.length > 0 && (
            <View style={styles.concernsSection}>
              <Text style={[styles.concernsLabel, { color: colors.textSecondary }]}>Areas to Focus On</Text>
              <View style={styles.concernsTags}>
                {analysis.skin_concerns.map((concern, index) => (
                  <View key={index} style={[styles.concernTag, { backgroundColor: colors.error + '18' }]}>
                    <Text style={[styles.concernTagText, { color: colors.error }]}>{concern}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {analysis.texture_analysis && (
            <View style={[styles.textureSection, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.textureLabel, { color: colors.textSecondary }]}>Texture Analysis</Text>
              <Text style={[styles.textureText, { color: colors.text }]}>{analysis.texture_analysis}</Text>
            </View>
          )}
        </View>

        <View style={[styles.tabContainer, { backgroundColor: colors.surfaceVariant }]}>
          <TouchableOpacity style={[styles.tab, activeTab === 'ai' && { backgroundColor: colors.primaryLight }]} onPress={() => setActiveTab('ai')}>
            <Ionicons name="sparkles" size={18} color={activeTab === 'ai' ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabText, { color: activeTab === 'ai' ? colors.primary : colors.textTertiary }]}>For You</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'curated' && { backgroundColor: colors.primaryLight }]} onPress={() => setActiveTab('curated')}>
            <Ionicons name="star" size={18} color={activeTab === 'curated' ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabText, { color: activeTab === 'curated' ? colors.primary : colors.textTertiary }]}>Expert Picks</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recommendationsSection}>
          {activeTab === 'ai' ? (
            analysis.ai_recommendations.map((rec, index) => (
              <View key={index} style={[styles.recommendationCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <View style={styles.recHeader}>
                  <View style={[styles.recIcon, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name={getCategoryIcon(rec.category) as any} size={22} color={colors.primary} />
                  </View>
                  <View style={styles.recHeaderText}>
                    <Text style={[styles.recCategory, { color: colors.primary }]}>{rec.category}</Text>
                    <Text style={[styles.recTitle, { color: colors.text }]}>{rec.recommendation}</Text>
                  </View>
                </View>
                {rec.shade_range && rec.shade_range !== 'N/A' && (
                  <View style={styles.recDetail}>
                    <Text style={[styles.recDetailLabel, { color: colors.textSecondary }]}>Shade Range</Text>
                    <Text style={[styles.recDetailValue, { color: colors.text }]}>{rec.shade_range}</Text>
                  </View>
                )}
                <View style={styles.recDetail}>
                  <Text style={[styles.recDetailLabel, { color: colors.textSecondary }]}>Application Tips</Text>
                  <Text style={[styles.recDetailValue, { color: colors.text }]}>{rec.tips}</Text>
                </View>
                <View style={[styles.recReason, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="bulb" size={16} color={colors.primary} />
                  <Text style={[styles.recReasonText, { color: colors.primary }]}>{rec.reason}</Text>
                </View>
              </View>
            ))
          ) : (
            curatedRecs.map((rec, index) => (
              <View key={index} style={[styles.recommendationCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <View style={styles.recHeader}>
                  <View style={[styles.recIcon, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name={getCategoryIcon(rec.category) as any} size={22} color={colors.primary} />
                  </View>
                  <View style={styles.recHeaderText}>
                    <Text style={[styles.recCategory, { color: colors.primary }]}>{rec.category}</Text>
                    <Text style={[styles.recTitle, { color: colors.text }]}>{rec.product_name}</Text>
                  </View>
                </View>
                <View style={styles.recDetail}>
                  <Text style={[styles.recDetailValue, { color: colors.text }]}>{rec.description}</Text>
                </View>
                <View style={[styles.recReason, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="bulb" size={16} color={colors.primary} />
                  <Text style={[styles.recReasonText, { color: colors.primary }]}>{rec.tips}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={[styles.newAnalysisButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/(tabs)/analyze')}>
          <Ionicons name="camera" size={22} color="#FFF" />
          <Text style={styles.newAnalysisText}>New Analysis</Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <View style={styles.disclaimerRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.textTertiary} />
          <Text style={[styles.disclaimerText, { color: colors.textTertiary }]}>
            We respect your privacy and do not store any personal data. Results are for informational purposes only — try recommendations at your own discretion.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  errorText: { fontSize: 16 },
  backButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: '#FFF', fontWeight: '600' },
  profileCard: { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  profileTitle: { fontSize: 18, fontWeight: '700' },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  profileItem: { width: '47%', borderRadius: 12, padding: 14 },
  profileLabel: { fontSize: 11, marginBottom: 4, textTransform: 'uppercase' },
  profileValue: { fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  concernsSection: { marginBottom: 16 },
  concernsLabel: { fontSize: 13, marginBottom: 10 },
  concernsTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  concernTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  concernTagText: { fontSize: 12, textTransform: 'capitalize' },
  textureSection: { borderTopWidth: 1, paddingTop: 16 },
  textureLabel: { fontSize: 13, marginBottom: 8 },
  textureText: { fontSize: 14, lineHeight: 22 },
  tabContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  tabText: { fontSize: 13, fontWeight: '600' },
  recommendationsSection: { gap: 16, marginBottom: 24 },
  recommendationCard: { borderRadius: 16, padding: 18, borderWidth: 1 },
  recHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  recIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  recHeaderText: { flex: 1 },
  recCategory: { fontSize: 11, textTransform: 'uppercase', marginBottom: 2 },
  recTitle: { fontSize: 15, fontWeight: '600' },
  recDetail: { marginBottom: 12 },
  recDetailLabel: { fontSize: 11, marginBottom: 4 },
  recDetailValue: { fontSize: 13, lineHeight: 20 },
  recReason: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10 },
  recReasonText: { flex: 1, fontSize: 12, lineHeight: 18 },
  newAnalysisButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, padding: 16 },
  newAnalysisText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  disclaimerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 16, paddingHorizontal: 4 },
  disclaimerText: { flex: 1, fontSize: 10, lineHeight: 15 },
});
