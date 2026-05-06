import React, { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator, I18nManager } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { api } from '../src/services/api';

// Lock the app to LTR (left-to-right) layout regardless of device locale.
// This release ships English-only; users on RTL device locales (Arabic, Hebrew, etc.)
// shouldn't see the layout flip. Future i18n release will revisit this.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

function useProtectedRoute() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inTabs = segments[0] === '(tabs)';

    // ONLY handle logout redirect: user is null but still in app
    if (!user && inTabs) {
      router.replace('/');
    }
    // Login redirect is handled by the login screen's own useEffect
  }, [user, loading, segments]);
}

function useBackendWarmup() {
  // Kick off a warmup ping on app launch to kill cold-start latency.
  // Non-blocking and non-fatal — the app works even if this fails.
  useEffect(() => {
    api.warmup().catch(() => {});
  }, []);
}

function InnerLayout() {
  const { isDark, colors } = useTheme();
  const { loading } = useAuth();

  useProtectedRoute();
  useBackendWarmup();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="set-name" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="analysis-result" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-profile" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemeProvider>
        <AuthProvider>
          <InnerLayout />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
