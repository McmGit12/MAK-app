import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export type MakErrorVariant = 'busy' | 'timeout' | 'badImage' | 'network' | 'generic';

interface VariantConfig {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColorKey: 'primary' | 'secondary' | 'tertiary' | 'accent';
  title: string;
  body: string;
  primaryCta: string;
  secondaryCta?: string;
}

const VARIANTS: Record<MakErrorVariant, VariantConfig> = {
  busy: {
    iconName: 'sparkles',
    iconColorKey: 'primary',
    title: 'Almost there!',
    body: 'The service is a little busy right now — give it a moment, then tap below.',
    primaryCta: 'Try Again',
    secondaryCta: 'Choose Different Photo',
  },
  timeout: {
    iconName: 'time-outline',
    iconColorKey: 'secondary',
    title: 'This is taking a moment',
    body: 'Your analysis is running a bit slow — let\u2019s give it another go.',
    primaryCta: 'Try Again',
    secondaryCta: 'Choose Different Photo',
  },
  badImage: {
    iconName: 'image-outline',
    iconColorKey: 'accent',
    title: 'Let\u2019s try a different photo',
    body: 'For the best results, use a clear, well-lit photo with your face centered and visible.',
    primaryCta: 'Choose Another Photo',
  },
  network: {
    iconName: 'wifi-outline',
    iconColorKey: 'tertiary',
    title: 'Connection hiccup',
    body: 'We can\u2019t reach our servers right now. Check your internet and tap below.',
    primaryCta: 'Try Again',
  },
  generic: {
    iconName: 'refresh-outline',
    iconColorKey: 'primary',
    title: 'Something went sideways',
    body: 'Don\u2019t worry, this happens sometimes. Tap to try again.',
    primaryCta: 'Try Again',
  },
};

interface Props {
  visible: boolean;
  variant: MakErrorVariant;
  onClose: () => void;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
  // Optional overrides (rare)
  customTitle?: string;
  customBody?: string;
}

const SCREEN = Dimensions.get('window');

export function MakErrorSheet({
  visible,
  variant,
  onClose,
  onPrimaryPress,
  onSecondaryPress,
  customTitle,
  customBody,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN.height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const config = VARIANTS[variant];
  const title = customTitle ?? config.title;
  const body = customBody ?? config.body;
  const iconColor = colors[config.iconColorKey];
  const iconBg =
    config.iconColorKey === 'primary'
      ? colors.primaryLight
      : config.iconColorKey === 'secondary'
      ? colors.secondaryLight
      : config.iconColorKey === 'tertiary'
      ? colors.tertiaryLight
      : colors.accentLight;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN.height,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop — tap to dismiss */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim, backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close error sheet" />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              transform: [{ translateY: slideAnim }],
              shadowColor: colors.text,
            },
          ]}
        >
          {/* Drag handle (visual cue) */}
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />

          {/* X close button */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Soft icon circle */}
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <Ionicons name={config.iconName} size={28} color={iconColor} />
          </View>

          {/* Title — no truncation, wraps freely */}
          <Text
            style={[styles.title, { color: colors.text }]}
            allowFontScaling
            accessibilityRole="header"
          >
            {title}
          </Text>

          {/* Body — no truncation, line-height optimized for readability */}
          <Text style={[styles.body, { color: colors.textSecondary }]} allowFontScaling>
            {body}
          </Text>

          {/* Primary CTA */}
          <TouchableOpacity
            onPress={onPrimaryPress}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
            accessibilityLabel={config.primaryCta}
            accessibilityRole="button"
          >
            <Text style={[styles.primaryBtnText, { color: colors.buttonText }]}>{config.primaryCta}</Text>
          </TouchableOpacity>

          {/* Secondary action (if defined) */}
          {config.secondaryCta && onSecondaryPress ? (
            <TouchableOpacity
              onPress={onSecondaryPress}
              style={styles.secondaryBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>{config.secondaryCta}</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 24,
    alignItems: 'center',
    // Native shadow
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
    // Cap height — long-text safety
    maxHeight: SCREEN.height * 0.85,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Big tap target via hitSlop
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
    // Allow wrapping
    flexShrink: 1,
    width: '100%',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
    flexShrink: 1,
    width: '100%',
  },
  primaryBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryBtn: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default MakErrorSheet;
