import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  // Set true to show the "first scan can take 20-30s" hint
  showFirstScanHint?: boolean;
  // Override messages if needed
  messages?: string[];
  // Rotation interval in ms (default 5000)
  intervalMs?: number;
}

const DEFAULT_MESSAGES = [
  'Analyzing your skin...',
  'Looking at your skin tone & texture...',
  'Crafting personalized recommendations...',
  'Almost done — adding final touches ✨',
];

export function MakLoadingRotator({
  showFirstScanHint = true,
  messages = DEFAULT_MESSAGES,
  intervalMs = 5000,
}: Props) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      // Fade out -> swap text -> fade in
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [messages, intervalMs, fadeAnim]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />

      <Animated.Text
        style={[styles.message, { color: colors.text, opacity: fadeAnim }]}
        allowFontScaling
        numberOfLines={2}
      >
        {messages[index]}
      </Animated.Text>

      {showFirstScanHint ? (
        <View style={[styles.hintBox, { backgroundColor: colors.primaryLight }]}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.primary}
            style={styles.hintIcon}
          />
          <Text
            style={[styles.hintText, { color: colors.text }]}
            allowFontScaling
          >
            First scan can take 20–30 seconds — hang tight, this is normal!
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
    minHeight: 44, // 2 lines reserved
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
