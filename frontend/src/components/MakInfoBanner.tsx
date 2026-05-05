import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  text?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'accent';
}

export function MakInfoBanner({
  text = 'First scan after install may take up to 30 seconds — that\u2019s normal ✨',
  iconName = 'information-circle-outline',
  variant = 'primary',
}: Props) {
  const { colors } = useTheme();

  const bgColor =
    variant === 'primary'
      ? colors.primaryLight
      : variant === 'secondary'
      ? colors.secondaryLight
      : variant === 'tertiary'
      ? colors.tertiaryLight
      : colors.accentLight;

  const iconColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
      ? colors.secondary
      : variant === 'tertiary'
      ? colors.tertiary
      : colors.accent;

  return (
    <View style={[styles.banner, { backgroundColor: bgColor }]} accessibilityRole="alert">
      <Ionicons name={iconName} size={18} color={iconColor} style={styles.icon} />
      <Text
        style={[styles.text, { color: colors.text }]}
        allowFontScaling
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    width: '100%',
  },
  icon: {
    marginRight: 10,
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    flexShrink: 1,
  },
});

export default MakInfoBanner;
