import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';

interface Analysis {
  id: string;
  skin_type: string;
  skin_tone: string;
  undertone: string;
  face_shape: string;
  skin_concerns: string[];
  created_at: string;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalyses = async () => {
    if (!user?.id) return;
    try {
      const data = await api.getUserAnalyses(user.id);
      setAnalyses(data);
    } catch (err) {
      console.log('Error fetching analyses:', err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAnalyses(); }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalyses();
    setRefreshing(false);
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderAnalysisItem = ({ item, index }: { item: Analysis; index: number }) => (
    <TouchableOpacity
      style={[styles.analysisCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
      onPress={() => router.push({ pathname: '/analysis-result', params: { analysisId: item.id } })}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardNumber, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.cardNumberText, { color: colors.primary }]}>#{analyses.length - index}</Text>
        </View>
        <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Skin Type</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{item.skin_type}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Tone</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{item.skin_tone}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Shape</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{item.face_shape}</Text>
          </View>
        </View>
        {item.skin_concerns && item.skin_concerns.length > 0 && (
          <View style={styles.concernsContainer}>
            {item.skin_concerns.slice(0, 3).map((concern, idx) => (
              <View key={idx} style={[styles.concernTag, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.concernText, { color: colors.primary }]}>{concern}</Text>
              </View>
            ))}
            {item.skin_concerns.length > 3 && (
              <View style={[styles.concernTag, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.concernText, { color: colors.primary }]}>+{item.skin_concerns.length - 3}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <View style={styles.cardFooter}>
        <Text style={[styles.viewDetails, { color: colors.primary }]}>View Details</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Analysis History</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {analyses.length} {analyses.length === 1 ? 'analysis' : 'analyses'}
            </Text>
          </View>
        </View>
      </View>
      {analyses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="time-outline" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Analyses Yet</Text>
          <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>Start your first skin analysis to see your history here</Text>
          <TouchableOpacity style={[styles.startButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/(tabs)/analyze')}>
            <Text style={styles.startButtonText}>Start Analysis</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={analyses}
          renderItem={renderAnalysisItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 20, paddingTop: 0, paddingBottom: 100 },
  analysisCard: { borderRadius: 16, marginBottom: 16, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  cardNumber: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  cardNumberText: { fontSize: 12, fontWeight: '600' },
  cardDate: { fontSize: 12 },
  cardContent: { padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 11, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  concernsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  concernTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  concernText: { fontSize: 11, textTransform: 'capitalize' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', padding: 12, paddingTop: 0 },
  viewDetails: { fontSize: 13, fontWeight: '600', marginRight: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptyDescription: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  startButton: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  startButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
