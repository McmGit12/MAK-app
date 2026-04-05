import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';

export default function AnalyzeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to take photos.');
        return;
      }
    }
    setCameraMode(true);
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        setImage(`data:image/jpeg;base64,${photo.base64}`);
        setCameraMode(false);
      } catch (err) {
        console.error('Failed to capture:', err);
        Alert.alert('Error', 'Failed to capture photo');
      }
    }
  };

  const analyzeImage = async () => {
    if (!image || !user?.id) return;

    setAnalyzing(true);
    try {
      // Extract base64 data without the prefix
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const result = await api.analyzeSkin(base64Data, user.id);
      
      router.push({
        pathname: '/analysis-result',
        params: { analysisId: result.id }
      });
    } catch (err: any) {
      Alert.alert('Analysis Failed', err.message || 'Please try again with a clearer photo');
    } finally {
      setAnalyzing(false);
    }
  };

  if (cameraMode) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        >
          <SafeAreaView style={styles.cameraOverlay}>
            <TouchableOpacity
              style={styles.closeCameraButton}
              onPress={() => setCameraMode(false)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.faceGuide}>
              <View style={styles.faceGuideOval} />
              <Text style={styles.faceGuideText}>Position your face in the oval</Text>
            </View>

            <View style={styles.captureButtonContainer}>
              <TouchableOpacity style={styles.captureButton} onPress={capturePhoto}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Skin Analysis</Text>
          <Text style={styles.subtitle}>Get AI-powered beauty recommendations</Text>
        </View>

        {/* Image Preview or Upload Area */}
        <View style={styles.imageSection}>
          {image ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setImage(null)}
              >
                <Ionicons name="close-circle" size={32} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadArea}>
              <View style={styles.uploadIcon}>
                <Ionicons name="image-outline" size={48} color="#D4AF37" />
              </View>
              <Text style={styles.uploadTitle}>Upload Your Photo</Text>
              <Text style={styles.uploadDescription}>
                Take a selfie or upload a clear photo of your face for accurate analysis
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {!image ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
              <View style={styles.actionButtonIcon}>
                <Ionicons name="camera" size={28} color="#D4AF37" />
              </View>
              <Text style={styles.actionButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
              <View style={styles.actionButtonIcon}>
                <Ionicons name="images" size={28} color="#D4AF37" />
              </View>
              <Text style={styles.actionButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.analyzeSection}>
            <TouchableOpacity
              style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
              onPress={analyzeImage}
              disabled={analyzing}
            >
              {analyzing ? (
                <View style={styles.analyzingContent}>
                  <ActivityIndicator color="#0D0D0D" size="small" />
                  <Text style={styles.analyzeButtonText}>Analyzing...</Text>
                </View>
              ) : (
                <View style={styles.analyzingContent}>
                  <Ionicons name="sparkles" size={24} color="#0D0D0D" />
                  <Text style={styles.analyzeButtonText}>Analyze My Skin</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => setImage(null)}
            >
              <Text style={styles.retakeButtonText}>Choose Different Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Tips for Best Results</Text>
          <View style={styles.tipItem}>
            <Ionicons name="sunny-outline" size={20} color="#D4AF37" />
            <Text style={styles.tipText}>Good lighting, preferably natural</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="happy-outline" size={20} color="#D4AF37" />
            <Text style={styles.tipText}>Face the camera directly</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="water-outline" size={20} color="#D4AF37" />
            <Text style={styles.tipText}>Clean face, no makeup if possible</Text>
          </View>
        </View>
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  imageSection: {
    marginBottom: 24,
  },
  uploadArea: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: '#1A1A1A',
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  actionButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  analyzeSection: {
    gap: 12,
    marginBottom: 24,
  },
  analyzeButton: {
    backgroundColor: '#D4AF37',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  analyzeButtonDisabled: {
    opacity: 0.7,
  },
  analyzingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  analyzeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  retakeButton: {
    padding: 12,
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: 14,
    color: '#D4AF37',
    fontWeight: '600',
  },
  tipsSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#CCC',
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  closeCameraButton: {
    alignSelf: 'flex-start',
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  faceGuide: {
    alignItems: 'center',
  },
  faceGuideOval: {
    width: 220,
    height: 300,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.6)',
    borderStyle: 'dashed',
  },
  faceGuideText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 16,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  captureButtonContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212, 175, 55, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#D4AF37',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D4AF37',
  },
});
