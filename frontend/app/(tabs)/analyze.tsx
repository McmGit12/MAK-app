import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
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

export default function AnalyzeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

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
      console.error('Image picker error:', err);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) { Alert.alert('Permission Required', 'Camera access is needed to take photos.'); return; }
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
      } catch (err) {
        console.error('Failed to capture:', err);
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  const clearImage = () => { setImageUri(null); setImageBase64(null); };

  const analyzeImage = async () => {
    if (!imageBase64 || !user?.id) { Alert.alert('Error', 'Please select or take a photo first'); return; }
    setAnalyzing(true);
    try {
      const result = await api.analyzeSkin(imageBase64, user.id);
      router.push({ pathname: '/analysis-result', params: { analysisId: result.id } });
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Skin Analysis</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Get personalized beauty recommendations</Text>
        </View>

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
              <View style={[styles.uploadIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="image-outline" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.uploadTitle, { color: colors.text }]}>Upload Your Photo</Text>
              <Text style={[styles.uploadDescription, { color: colors.textSecondary }]}>Take a selfie or upload a clear photo of your face for accurate analysis</Text>
            </View>
          )}
        </View>

        {!imageUri ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={takePhoto}>
              <View style={[styles.actionButtonIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="camera" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={pickImage}>
              <View style={[styles.actionButtonIcon, { backgroundColor: colors.secondaryLight }]}>
                <Ionicons name="images" size={28} color={colors.secondary} />
              </View>
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Gallery</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.analyzeSection}>
            <TouchableOpacity style={[styles.analyzeButton, { backgroundColor: colors.primary }, analyzing && styles.analyzeButtonDisabled]} onPress={analyzeImage} disabled={analyzing}>
              {analyzing ? (
                <View style={styles.analyzingContent}>
                  <ActivityIndicator color="#FFF" size="small" />
                  <Text style={styles.analyzeButtonText}>Analyzing...</Text>
                </View>
              ) : (
                <View style={styles.analyzingContent}>
                  <Ionicons name="sparkles" size={24} color="#FFF" />
                  <Text style={styles.analyzeButtonText}>Analyze My Skin</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.retakeButton} onPress={clearImage}>
              <Text style={[styles.retakeButtonText, { color: colors.primary }]}>Choose Different Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.tipsSection, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>Tips for Best Results</Text>
          {[
            { icon: 'sunny-outline', text: 'Good lighting, preferably natural' },
            { icon: 'happy-outline', text: 'Face the camera directly' },
            { icon: 'water-outline', text: 'Clean face, no makeup if possible' },
          ].map((tip, i) => (
            <View key={i} style={styles.tipItem}>
              <Ionicons name={tip.icon as any} size={20} color={colors.primary} />
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  imageSection: { marginBottom: 24 },
  uploadArea: { borderRadius: 24, padding: 40, alignItems: 'center', borderWidth: 2, borderStyle: 'dashed' },
  uploadIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  uploadTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  uploadDescription: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  imageContainer: { position: 'relative', alignItems: 'center' },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: 24 },
  removeImageButton: { position: 'absolute', top: 12, right: 12, borderRadius: 16 },
  actionButtons: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  actionButton: { flex: 1, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1 },
  actionButtonIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
  analyzeSection: { gap: 12, marginBottom: 24 },
  analyzeButton: { borderRadius: 16, padding: 18, alignItems: 'center' },
  analyzeButtonDisabled: { opacity: 0.7 },
  analyzingContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analyzeButtonText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  retakeButton: { padding: 12, alignItems: 'center' },
  retakeButtonText: { fontSize: 14, fontWeight: '600' },
  tipsSection: { borderRadius: 16, padding: 20, borderWidth: 1 },
  tipsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  tipItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  tipText: { fontSize: 14 },
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
