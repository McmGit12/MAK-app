import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState('app_experience');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const submitFeedback = async () => {
    if (!user?.id) return;

    setSubmitting(true);
    try {
      await api.submitFeedback({
        user_id: user.id,
        rating: feedbackRating,
        category: feedbackCategory,
        comment: feedbackComment || undefined,
      });
      Alert.alert('Thank You!', 'Your feedback has been submitted successfully.');
      setShowFeedback(false);
      setFeedbackComment('');
      setFeedbackRating(5);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { id: 'app_experience', label: 'App Experience', icon: 'phone-portrait' },
    { id: 'recommendations', label: 'Recommendations', icon: 'sparkles' },
    { id: 'analysis_accuracy', label: 'Analysis Accuracy', icon: 'analytics' },
  ];

  const menuItems = [
    {
      icon: 'chatbubble-outline',
      title: 'Give Feedback',
      description: 'Help us improve',
      onPress: () => setShowFeedback(true),
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Privacy Policy',
      description: 'Your data is safe with us',
      onPress: () => Alert.alert('Privacy', 'We do not store any personal identifying information. Your photos are analyzed and immediately discarded.'),
    },
    {
      icon: 'information-circle-outline',
      title: 'About',
      description: 'Learn more about ComplexionFit',
      onPress: () => Alert.alert('ComplexionFit', 'Version 1.0.0\n\nYour AI-powered beauty advisor that analyzes your skin and provides personalized makeup recommendations.'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={32} color="#D4AF37" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>User</Text>
            <Text style={styles.userMethod}>
              Logged in via {user?.login_method || 'email'}
            </Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemIcon}>
                <Ionicons name={item.icon as any} size={22} color="#D4AF37" />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
                <Text style={styles.menuItemDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#FF6B6B" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Feedback Modal */}
        {showFeedback && (
          <View style={styles.feedbackOverlay}>
            <View style={styles.feedbackModal}>
              <View style={styles.feedbackHeader}>
                <Text style={styles.feedbackTitle}>Share Feedback</Text>
                <TouchableOpacity onPress={() => setShowFeedback(false)}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Rating */}
              <View style={styles.ratingSection}>
                <Text style={styles.feedbackLabel}>Rating</Text>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setFeedbackRating(star)}
                    >
                      <Ionicons
                        name={star <= feedbackRating ? 'star' : 'star-outline'}
                        size={32}
                        color="#D4AF37"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category */}
              <View style={styles.categorySection}>
                <Text style={styles.feedbackLabel}>Category</Text>
                <View style={styles.categoryOptions}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryOption,
                        feedbackCategory === cat.id && styles.categoryOptionActive,
                      ]}
                      onPress={() => setFeedbackCategory(cat.id)}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={18}
                        color={feedbackCategory === cat.id ? '#0D0D0D' : '#D4AF37'}
                      />
                      <Text
                        style={[
                          styles.categoryOptionText,
                          feedbackCategory === cat.id && styles.categoryOptionTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Comment */}
              <View style={styles.commentSection}>
                <Text style={styles.feedbackLabel}>Comments (Optional)</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Share your thoughts..."
                  placeholderTextColor="#666"
                  value={feedbackComment}
                  onChangeText={setFeedbackComment}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitFeedback}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#0D0D0D" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Feedback</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userMethod: {
    fontSize: 13,
    color: '#888',
    textTransform: 'capitalize',
  },
  menuSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.1)',
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 12,
    color: '#888',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  feedbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  feedbackModal: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  ratingSection: {
    marginBottom: 24,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 8,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryOptions: {
    gap: 10,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  categoryOptionActive: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#D4AF37',
    fontWeight: '500',
  },
  categoryOptionTextActive: {
    color: '#0D0D0D',
  },
  commentSection: {
    marginBottom: 24,
  },
  commentInput: {
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  submitButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D0D0D',
  },
});
