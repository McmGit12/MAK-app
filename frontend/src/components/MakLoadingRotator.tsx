import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { STRINGS, AnalyzeMode } from '../constants/strings';

interface Props {
  /** Which analysis mode the user is in. Determines message set. */
  mode?: AnalyzeMode;
  /** Override messages if needed (rare). */
  messages?: string[];
  /** Rotation interval in ms (default 5000). */
  intervalMs?: number;
  /** Delay (ms) before showing the "first scan can take 20-30s" hint. Default 10000. */
  hintDelayMs?: number;
  /** Force-show the hint (bypasses delay). Default false. */
  alwaysShowHint?: boolean;
}

export function MakLoadingRotator({
  mode = 'skinCare',
  messages,
  intervalMs = 5000,
  hintDelayMs = 10000,
  alwaysShowHint = false,
}: Props) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [showHint, setShowHint] = useState(alwaysShowHint);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Resolve message set
  const resolvedMessages = messages ?? STRINGS.loading[mode];

  // Rotate messages every `intervalMs`
  useEffect(() => {
    if (resolvedMessages.length <= 1) return;

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        setIndex((prev) => (prev + 1) % resolvedMessages.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [resolvedMessages, intervalMs, fadeAnim]);

  // Show the "first scan slow" hint only after delay (b: smart contextual hint)
  useEffect(() => {
    if (alwaysShowHint) {
      setShowHint(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowHint(true);
    }, hintDelayMs);

    return () => clearTimeout(timer);
  }, [hintDelayMs, alwaysShowHint]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />

      <Animated.Text
        style={[
          styles.message,
          { color: colors.text, opacity: fadeAnim, writingDirection: 'ltr' },
        ]}
        allowFontScaling
        numberOfLines={2}
      >
        {resolvedMessages[index]}
      </Animated.Text>

      {showHint ? (
        <View style={[styles.hintBox, { backgroundColor: colors.primaryLight }]}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.primary}
            style={styles.hintIcon}
          />
          <Text
            style={[styles.hintText, { color: colors.text, writingDirection: 'ltr' }]}
            allowFontScaling
          >
            {STRINGS.loadingHints.delayed}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  message: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 44,
    flexShrink: 1,
    width: '100%',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 24,
    width: '100%',
    maxWidth: 360,
  },
  hintIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
});

export default MakLoadingRotator;
