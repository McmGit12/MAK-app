import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  user_hash: string;
  login_method: string;
  display_name?: string | null;
  created_at: string;
}

interface StoredSession {
  user: User;
  loginTimestamp: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateUserName: (displayName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = '@mak_session';
const SESSION_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const session: StoredSession = JSON.parse(stored);
        const elapsed = Date.now() - session.loginTimestamp;
        if (elapsed < SESSION_DURATION_MS) {
          setUser(session.user);
        } else {
          // Session expired
          await AsyncStorage.removeItem(USER_STORAGE_KEY);
          console.log('Session expired after 48 hours');
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userData: User) => {
    try {
      const session: StoredSession = {
        user: userData,
        loginTimestamp: Date.now(),
      };
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session));
      setUser(userData);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
    } catch (error) {
      console.error('Error removing session:', error);
    }
  };

  const updateUserName = async (displayName: string) => {
    if (!user) return;
    try {
      const updatedUser = { ...user, display_name: displayName };
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      let loginTimestamp = Date.now();
      if (stored) {
        const session: StoredSession = JSON.parse(stored);
        loginTimestamp = session.loginTimestamp;
      }
      const session: StoredSession = { user: updatedUser, loginTimestamp };
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session));
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating user name:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUserName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
