import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  primaryLight: string;
  secondary: string;
  secondaryLight: string;
  tertiary: string;
  tertiaryLight: string;
  accent: string;
  accentLight: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  error: string;
  success: string;
  tabBar: string;
  tabBarBorder: string;
  inputBg: string;
  buttonText: string;
  overlay: string;
}

const lightColors: ThemeColors = {
  background: '#FFF8F5',
  surface: '#FFFFFF',
  surfaceVariant: '#FFF0EC',
  primary: '#D4849A',
  primaryLight: 'rgba(212, 132, 154, 0.12)',
  secondary: '#A98EC4',
  secondaryLight: 'rgba(169, 142, 196, 0.12)',
  tertiary: '#7CC5B2',
  tertiaryLight: 'rgba(124, 197, 178, 0.12)',
  accent: '#C9946A',
  accentLight: 'rgba(201, 148, 106, 0.12)',
  text: '#2D2D3F',
  textSecondary: '#8E8E9E',
  textTertiary: '#B5B5C5',
  border: 'rgba(212, 132, 154, 0.2)',
  borderLight: 'rgba(212, 132, 154, 0.08)',
  error: '#E85D75',
  success: '#7CC5B2',
  tabBar: '#FFFFFF',
  tabBarBorder: 'rgba(212, 132, 154, 0.15)',
  inputBg: '#FFF0EC',
  buttonText: '#FFFFFF',
  overlay: 'rgba(45, 45, 63, 0.6)',
};

const darkColors: ThemeColors = {
  background: '#1A1520',
  surface: '#2A2235',
  surfaceVariant: '#352A42',
  primary: '#E8A0BF',
  primaryLight: 'rgba(232, 160, 191, 0.15)',
  secondary: '#C4B0DB',
  secondaryLight: 'rgba(196, 176, 219, 0.15)',
  tertiary: '#9DD6C8',
  tertiaryLight: 'rgba(157, 214, 200, 0.15)',
  accent: '#D4A574',
  accentLight: 'rgba(212, 165, 116, 0.15)',
  text: '#F5F0F5',
  textSecondary: '#A0A0B0',
  textTertiary: '#706878',
  border: 'rgba(232, 160, 191, 0.2)',
  borderLight: 'rgba(232, 160, 191, 0.08)',
  error: '#FF7B8F',
  success: '#9DD6C8',
  tabBar: '#2A2235',
  tabBarBorder: 'rgba(232, 160, 191, 0.15)',
  inputBg: '#352A42',
  buttonText: '#1A1520',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = '@mak_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // v1.0.8: BOTH light & dark modes restored (per user feedback). Default = dark
  // since most testers preferred it. User preference persisted via AsyncStorage.
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved !== null) setIsDark(saved === 'dark');
      } catch (e) {
        // Non-fatal: keep default
      }
    })();
  }, []);

  const toggleTheme = async () => {
    try {
      const newMode = !isDark;
      setIsDark(newMode);
      await AsyncStorage.setItem(THEME_KEY, newMode ? 'dark' : 'light');
    } catch (e) {
      // Non-fatal: state still toggles in memory
    }
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
