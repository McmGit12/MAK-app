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
import { STRINGS } from '../constants/strings';

export type MakErrorVariant = 'busy' | 'timeout' | 'badImage' | 'network' | 'generic';

interface VariantVisualConfig {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColorKey: 'primary' | 'secondary' | 'tertiary' | 'accent';
}

const VARIANT_VISUALS: Record<MakErrorVariant, VariantVisualConfig> = {
  busy: { iconName: 'sparkles', iconColorKey: 'primary' },
  timeout: { iconName: 'time-outline', iconColorKey: 'secondary' },
  badImage: { iconName: 'image-outline', iconColorKey: 'accent' },
  network: { iconName: 'wifi-outline', iconColorKey: 'tertiary' },
  generic: { iconName: 'refresh-outline', iconColorKey: 'primary' },
};

interface Props {
  visible: boolean;
  variant: MakErrorVariant;
  onClose: () => void;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
  /** Override title (rare). */
  customTitle?: string;
  /** Override body (rare). */
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

  const visuals = VARIANT_VISUALS[variant];
  const copy = STRINGS.errors[variant];
  const title = customTitle ?? copy.title;
  const body = customBody ?? copy.body;
  const secondaryCta = 'secondaryCta' in copy ? copy.secondaryCta : undefined;
  const iconColor = colors[visuals.iconColorKey];
  const iconBg =
    visuals.iconColorKey === 'primary'
      ? colors.primaryLight
      : visuals.iconColorKey === 'secondary'
      ? colors.secondaryLight
      : visuals.iconColorKey === 'tertiary'
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
        <Animated.View
          style={[styles.backdrop, { opacity: fadeAnim, backgroundColor: colors.overlay }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close error sheet"
          />
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
          <View style={[styles.handle, { backgroundColor: colors.borderLight }]} />

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <Ionicons name={visuals.iconName} size={28} color={iconColor} />
          </View>

          <Text
            style={[styles.title, { color: colors.text, writingDirection: 'ltr' }]}
            allowFontScaling
            accessibilityRole="header"
          >
            {title}
          </Text>

          <Text
            style={[styles.body, { color: colors.textSecondary, writingDirection: 'ltr' }]}
            allowFontScaling
          >
            {body}
          </Text>

          <TouchableOpacity
            onPress={onPrimaryPress}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
            accessibilityLabel={copy.primaryCta}
            accessibilityRole="button"
          >
            <Text
              style={[styles.primaryBtnText, { color: colors.buttonText, writingDirection: 'ltr' }]}
            >
              {copy.primaryCta}
            </Text>
          </TouchableOpacity>

          {secondaryCta && onSecondaryPress ? (
            <TouchableOpacity
              onPress={onSecondaryPress}
              style={styles.secondaryBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={[
                  styles.secondaryBtnText,
                  { color: colors.primary, writingDirection: 'ltr' },
                ]}
              >
                {secondaryCta}
              </Text>
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
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
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
