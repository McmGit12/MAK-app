import React, { createContext, useContext, ReactNode } from 'react';

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

// v1.0.6: App is now DARK MODE ONLY (per user request — looks more attractive
// and is the more flattering canvas for makeup/beauty content). Light mode
// removed. `isDark` and `toggleTheme` kept on the context for backwards
// compatibility but `isDark` is always true and toggleTheme is a no-op.
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Dark-only mode — toggleTheme is intentionally a no-op
  return (
    <ThemeContext.Provider value={{ isDark: true, colors: darkColors, toggleTheme: () => {} }}>
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
