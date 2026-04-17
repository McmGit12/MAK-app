import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';

type AnalysisMode = 'skin_care' | 'makeup';

const DISCLAIMER = 'We respect your privacy and do not store any personal data. Results are for informational purposes only — try recommendations at your own discretion.';

export default function AnalyzeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [mode, setMode] = useState<AnalysisMode>('skin_care');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const modeConfig = {
    skin_care: {
      title: 'Skin Care Routine',
      subtitle: 'Analyze your skin type, concerns, and get a personalized daily routine',
      icon: 'leaf' as const,
      analyzeText: 'Analyze My Skin',
      analyzingText: 'Analyzing Skin...',
      tips: [
        { icon: 'sunny-outline', text: 'Good natural lighting' },
        { icon: 'happy-outline', text: 'Face the camera directly' },
        { icon: 'water-outline', text: 'Clean face, no makeup' },
      ],
    },
    makeup: {
      title: 'Makeup Suggestions',
      subtitle: 'Scan your face to get personalized blush, lip, eye, and hair styling tips',
      icon: 'color-palette' as const,
      analyzeText: 'Get Makeup Tips',
      analyzingText: 'Finding Your Look...',
      tips: [
        { icon: 'sunny-outline', text: 'Good lighting for accurate color read' },
        { icon: 'happy-outline', text: 'Face forward, eyes open' },
        { icon: 'brush-outline', text: 'With or without current makeup' },
      ],
    },
  };

  const currentConfig = modeConfig[mode];

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (asset.base64) setImageBase64(asset.base64);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) { Alert.alert('Permission Required', 'Camera access is needed.'); return; }
    }
    setCameraMode(true);
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true });
        setImageUri(photo.uri);
        setImageBase64(photo.base64);
        setCameraMode(false);
      } catch (err) { Alert.alert('Error', 'Failed to capture photo'); }
    }
  };

  const clearImage = () => { setImageUri(null); setImageBase64(null); };

  const analyzeImage = async () => {
    if (!imageBase64 || !user?.id) { Alert.alert('Error', 'Please select or take a photo first'); return; }
    setAnalyzing(true);
    try {
      const result = await api.analyzeSkin(imageBase64, user.id, mode);
      router.push({ pathname: '/analysis-result', params: { analysisId: result.id, mode: mode } });
    } catch (err: any) {
      Alert.alert('Analysis Failed', err.message || 'Please try again with a clearer photo');
    } finally { setAnalyzing(false); }
  };

  if (cameraMode) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front">
          <SafeAreaView style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeCameraButton} onPress={() => setCameraMode(false)}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.faceGuide}>
              <View style={[styles.faceGuideOval, { borderColor: colors.primary }]} />
              <Text style={styles.faceGuideText}>Position your face in the oval</Text>
            </View>
            <View style={styles.captureButtonContainer}>
              <TouchableOpacity style={[styles.captureButton, { borderColor: colors.primary }]} onPress={capturePhoto}>
                <View style={[styles.captureButtonInner, { backgroundColor: colors.primary }]} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Choose Your Analysis</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>What would you like to know?</Text>
        </View>

        {/* Mode Tabs */}
        <View style={[styles.modeTabs, { backgroundColor: colors.surfaceVariant }]}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'skin_care' && { backgroundColor: colors.surface }]}
            onPress={() => setMode('skin_care')}
            activeOpacity={0.7}
          >
            <View style={[styles.modeTabIcon, { backgroundColor: mode === 'skin_care' ? colors.tertiaryLight : 'transparent' }]}>
              <Ionicons name="leaf" size={22} color={mode === 'skin_care' ? colors.tertiary : colors.textTertiary} />
            </View>
            <Text style={[styles.modeTabTitle, { color: mode === 'skin_care' ? colors.text : colors.textTertiary }]}>Skin Care</Text>
            <Text style={[styles.modeTabDesc, { color: mode === 'skin_care' ? colors.textSecondary : colors.textTertiary }]}>Daily routine</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, mode === 'makeup' && { backgroundColor: colors.surface }]}
            onPress={() => setMode('makeup')}
            activeOpacity={0.7}
          >
            <View style={[styles.modeTabIcon, { backgroundColor: mode === 'makeup' ? colors.primaryLight : 'transparent' }]}>
              <Ionicons name="color-palette" size={22} color={mode === 'makeup' ? colors.primary : colors.textTertiary} />
            </View>
            <Text style={[styles.modeTabTitle, { color: mode === 'makeup' ? colors.text : colors.textTertiary }]}>Makeup</Text>
            <Text style={[styles.modeTabDesc, { color: mode === 'makeup' ? colors.textSecondary : colors.textTertiary }]}>Suggestions</Text>
          </TouchableOpacity>
        </View>

        {/* Mode Description */}
        <View style={[styles.modeDescription, { backgroundColor: mode === 'skin_care' ? colors.tertiaryLight : colors.primaryLight, borderColor: mode === 'skin_care' ? colors.tertiary + '30' : colors.primary + '30' }]}>
          <Ionicons name={currentConfig.icon} size={20} color={mode === 'skin_care' ? colors.tertiary : colors.primary} />
          <Text style={[styles.modeDescText, { color: colors.text }]}>{currentConfig.subtitle}</Text>
        </View>

        {/* Image Upload */}
        <View style={styles.imageSection}>
          {imageUri ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={[styles.previewImage, { backgroundColor: colors.surfaceVariant }]} contentFit="cover" />
              <TouchableOpacity style={[styles.removeImageButton, { backgroundColor: colors.surface }]} onPress={clearImage}>
                <Ionicons name="close-circle" size={32} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.uploadArea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.uploadIcon, { backgroundColor: mode === 'skin_care' ? colors.tertiaryLight : colors.primaryLight }]}>
                <Ionicons name="image-outline" size={44} color={mode === 'skin_care' ? colors.tertiary : colors.primary} />
              </View>
              <Text style={[styles.uploadTitle, { color: colors.text }]}>Upload Your Photo</Text>
              <Text style={[styles.uploadDescription, { color: colors.textSecondary }]}>
                {mode === 'skin_care' ? 'A clear photo of your face for skin analysis' : 'Scan your face with or without makeup'}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {!imageUri ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={takePhoto}>
              <View style={[styles.actionButtonIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="camera" size={26} color={colors.primary} />
              </View>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={pickImage}>
              <View style={[styles.actionButtonIcon, { backgroundColor: colors.secondaryLight }]}>
                <Ionicons name="images" size={26} color={colors.secondary} />
              </View>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Gallery</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.analyzeSection}>
            <TouchableOpacity
              style={[styles.analyzeButton, { backgroundColor: mode === 'skin_care' ? colors.tertiary : colors.primary }, analyzing && styles.analyzeButtonDisabled]}
              onPress={analyzeImage}
              disabled={analyzing}
            >
              {analyzing ? (
                <View style={styles.analyzingContent}>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text style={styles.analyzeButtonText}>{currentConfig.analyzingText}</Text>
                </View>
              ) : (
                <View style={styles.analyzingContent}>
                  <Ionicons name={currentConfig.icon} size={22} color="#FFF" />
                  <Text style={styles.analyzeButtonText}>{currentConfig.analyzeText}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.retakeButton} onPress={clearImage}>
              <Text style={[styles.retakeButtonText, { color: colors.primary }]}>Choose Different Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tips */}
        <View style={[styles.tipsSection, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>Tips for Best Results</Text>
          {currentConfig.tips.map((tip, i) => (
            <View key={i} style={styles.tipItem}>
              <Ionicons name={tip.icon as any} size={20} color={mode === 'skin_care' ? colors.tertiary : colors.primary} />
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimerContainer}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textTertiary} />
          <Text style={[styles.disclaimerText, { color: colors.textTertiary }]}>{DISCLAIMER}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 20 },
  pageTitle: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { fontSize: 14 },
  // Mode Tabs
  modeTabs: { flexDirection: 'row', borderRadius: 16, padding: 6, marginBottom: 16, gap: 6 },
  modeTab: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 12 },
  modeTabIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  modeTabTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  modeTabDesc: { fontSize: 11 },
  // Mode Description
  modeDescription: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, marginBottom: 20, borderWidth: 1 },
  modeDescText: { flex: 1, fontSize: 13, lineHeight: 18 },
  // Image
  imageSection: { marginBottom: 20 },
  uploadArea: { borderRadius: 24, padding: 36, alignItems: 'center', borderWidth: 2, borderStyle: 'dashed' },
  uploadIcon: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  uploadTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  uploadDescription: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  imageContainer: { position: 'relative', alignItems: 'center' },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: 24 },
  removeImageButton: { position: 'absolute', top: 12, right: 12, borderRadius: 16 },
  // Actions
  actionButtons: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  actionButton: { flex: 1, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1 },
  actionButtonIcon: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
  analyzeSection: { gap: 12, marginBottom: 20 },
  analyzeButton: { borderRadius: 16, padding: 18, alignItems: 'center' },
  analyzeButtonDisabled: { opacity: 0.7 },
  analyzingContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analyzeButtonText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  retakeButton: { padding: 12, alignItems: 'center' },
  retakeButtonText: { fontSize: 14, fontWeight: '600' },
  // Tips
  tipsSection: { borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 16 },
  tipsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  tipItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  tipText: { fontSize: 13 },
  // Disclaimer
  disclaimerContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 4 },
  disclaimerText: { flex: 1, fontSize: 10, lineHeight: 15 },
  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  closeCameraButton: { alignSelf: 'flex-start', padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  faceGuide: { alignItems: 'center' },
  faceGuideOval: { width: 220, height: 300, borderRadius: 110, borderWidth: 2, borderStyle: 'dashed' },
  faceGuideText: { color: '#FFFFFF', fontSize: 14, marginTop: 16 },
  captureButtonContainer: { alignItems: 'center', paddingBottom: 20 },
  captureButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(212,132,154,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  captureButtonInner: { width: 56, height: 56, borderRadius: 28 },
});
