import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { MakErrorSheet, MakErrorVariant } from '../src/components/MakErrorSheet';
import { MakLoadingRotator } from '../src/components/MakLoadingRotator';
import { MakInfoBanner } from '../src/components/MakInfoBanner';

interface ErrorButton {
  variant: MakErrorVariant;
  label: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

const ERROR_BUTTONS: ErrorButton[] = [
  { variant: 'busy', label: '503 — Service Busy', description: 'LLM service overloaded', iconName: 'sparkles' },
  { variant: 'timeout', label: '504 — Timeout', description: 'Analysis took too long', iconName: 'time-outline' },
  { variant: 'badImage', label: '400 — Bad Image', description: 'Image unreadable', iconName: 'image-outline' },
  { variant: 'network', label: 'Network Error', description: 'No internet/server unreachable', iconName: 'wifi-outline' },
  { variant: 'generic', label: 'Generic Error', description: 'Catch-all fallback', iconName: 'refresh-outline' },
];

export default function ErrorPreviewScreen() {
  const { colors } = useTheme();
  const [activeVariant, setActiveVariant] = useState<MakErrorVariant | null>(null);
  const [showLoadingDemo, setShowLoadingDemo] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Error & Loading Preview</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1 — Info Banner */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Info Banner (always visible above scan)</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          This banner sits above the analyze section so users know what to expect before they tap.
        </Text>

        <MakInfoBanner />

        <View style={{ height: 12 }} />
        <MakInfoBanner
          variant="secondary"
          iconName="time-outline"
          text="Pro tip: clear, well-lit photos get the best results 💡"
        />

        <View style={styles.divider} />

        {/* Section 2 — Loading State */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Loading State (rotates every 5s)</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Replaces the boring single-line {`"Analyzing..."`} spinner with rotating reassuring messages + a first-scan hint.
        </Text>

        <TouchableOpacity
          onPress={() => setShowLoadingDemo(!showLoadingDemo)}
          style={[styles.toggleBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
        >
          <Ionicons
            name={showLoadingDemo ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={colors.primary}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.toggleBtnText, { color: colors.primary }]}>
            {showLoadingDemo ? 'Hide loading demo' : 'Show loading demo'}
          </Text>
        </TouchableOpacity>

        {showLoadingDemo ? (
          <View style={[styles.loadingPreview, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <MakLoadingRotator showFirstScanHint />
          </View>
        ) : null}

        <View style={styles.divider} />

        {/* Section 3 — Error Sheets */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Error Bottom Sheets (tap to preview)</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Each error type has its own warm message + retry CTA. X icon top-right OR tap outside to dismiss.
        </Text>

        {ERROR_BUTTONS.map((btn) => (
          <TouchableOpacity
            key={btn.variant}
            style={[styles.errorBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setActiveVariant(btn.variant)}
            activeOpacity={0.7}
          >
            <View style={[styles.errorBtnIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={btn.iconName} size={20} color={colors.primary} />
            </View>
            <View style={styles.errorBtnContent}>
              <Text style={[styles.errorBtnLabel, { color: colors.text }]}>{btn.label}</Text>
              <Text style={[styles.errorBtnDesc, { color: colors.textSecondary }]}>{btn.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Render the active error sheet */}
      {activeVariant ? (
        <MakErrorSheet
          visible={!!activeVariant}
          variant={activeVariant}
          onClose={() => setActiveVariant(null)}
          onPrimaryPress={() => {
            console.log('[Preview] Primary CTA tapped for:', activeVariant);
            setActiveVariant(null);
          }}
          onSecondaryPress={() => {
            console.log('[Preview] Secondary CTA tapped for:', activeVariant);
            setActiveVariant(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 28,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingPreview: {
    marginTop: 20,
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  errorBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  errorBtnContent: {
    flex: 1,
  },
  errorBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  errorBtnDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
});
