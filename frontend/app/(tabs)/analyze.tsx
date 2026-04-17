import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, TextInput, FlatList, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';

type Mode = 'skin_care' | 'makeup' | 'travel';

const DISCLAIMER = 'We respect your privacy and do not store any personal data. Results are for informational purposes only — try at your own discretion.';

const COUNTRIES = [
  { name: 'United States', flag: '\u{1F1FA}\u{1F1F8}' }, { name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}' },
  { name: 'India', flag: '\u{1F1EE}\u{1F1F3}' }, { name: 'France', flag: '\u{1F1EB}\u{1F1F7}' },
  { name: 'Italy', flag: '\u{1F1EE}\u{1F1F9}' }, { name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}' },
  { name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}' }, { name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}' },
  { name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}' }, { name: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}' },
  { name: 'Spain', flag: '\u{1F1EA}\u{1F1F8}' }, { name: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}' },
  { name: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}' }, { name: 'UAE', flag: '\u{1F1E6}\u{1F1EA}' },
  { name: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}' }, { name: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}' },
  { name: 'Turkey', flag: '\u{1F1F9}\u{1F1F7}' }, { name: 'Greece', flag: '\u{1F1EC}\u{1F1F7}' },
  { name: 'Indonesia', flag: '\u{1F1EE}\u{1F1E9}' }, { name: 'South Africa', flag: '\u{1F1FF}\u{1F1E6}' },
  { name: 'Egypt', flag: '\u{1F1EA}\u{1F1EC}' }, { name: 'Switzerland', flag: '\u{1F1E8}\u{1F1ED}' },
  { name: 'Netherlands', flag: '\u{1F1F3}\u{1F1F1}' }, { name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}' },
  { name: 'Sweden', flag: '\u{1F1F8}\u{1F1EA}' }, { name: 'New Zealand', flag: '\u{1F1F3}\u{1F1FF}' },
  { name: 'China', flag: '\u{1F1E8}\u{1F1F3}' }, { name: 'Russia', flag: '\u{1F1F7}\u{1F1FA}' },
  { name: 'Argentina', flag: '\u{1F1E6}\u{1F1F7}' }, { name: 'Colombia', flag: '\u{1F1E8}\u{1F1F4}' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const OCCASIONS = [
  { label: 'Wedding', icon: 'heart' },
  { label: 'Date Night', icon: 'wine' },
  { label: 'Business Meeting', icon: 'briefcase' },
  { label: 'Party / Nightlife', icon: 'musical-notes' },
  { label: 'Beach Vacation', icon: 'sunny' },
  { label: 'Sightseeing / Tourist', icon: 'camera' },
  { label: 'Festival / Concert', icon: 'sparkles' },
  { label: 'Family Gathering', icon: 'people' },
  { label: 'Solo Travel', icon: 'airplane' },
  { label: 'Religious / Cultural Event', icon: 'globe' },
];

export default function AnalyzeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('skin_care');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  // Travel state
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedOccasion, setSelectedOccasion] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [travelResult, setTravelResult] = useState<any>(null);
  const [travelLoading, setTravelLoading] = useState(false);

  const filteredCountries = COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()));

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
      if (!result.canceled && result.assets[0]) { setImageUri(result.assets[0].uri); if (result.assets[0].base64) setImageBase64(result.assets[0].base64); }
    } catch (err) { Alert.alert('Error', 'Failed to select image'); }
  };

  const takePhoto = async () => {
    if (!permission?.granted) { const r = await requestPermission(); if (!r.granted) { Alert.alert('Permission Required', 'Camera access needed.'); return; } }
    setCameraMode(true);
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      try { const p = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true }); setImageUri(p.uri); setImageBase64(p.base64); setCameraMode(false); }
      catch (err) { Alert.alert('Error', 'Failed to capture photo'); }
    }
  };

  const clearImage = () => { setImageUri(null); setImageBase64(null); };

  const analyzeImage = async () => {
    if (!imageBase64 || !user?.id) { Alert.alert('Error', 'Please select or take a photo first'); return; }
    setAnalyzing(true);
    try {
      const result = await api.analyzeSkin(imageBase64, user.id, mode);
      router.push({ pathname: '/analysis-result', params: { analysisId: result.id, mode } });
    } catch (err: any) { Alert.alert('Analysis Failed', err.message || 'Please try again'); } finally { setAnalyzing(false); }
  };

  const getTravelSuggestions = async () => {
    if (!selectedCountry || !selectedMonth || !selectedOccasion) { Alert.alert('Missing Info', 'Please select country, month, and occasion.'); return; }
    setTravelLoading(true);
    try {
      const result = await api.getTravelStyle(selectedCountry, selectedMonth, selectedOccasion, user?.id);
      setTravelResult(result);
    } catch (err: any) { Alert.alert('Error', 'Failed to get suggestions. Try again.'); } finally { setTravelLoading(false); }
  };

  if (cameraMode) {
    return (
      <View style={s.cameraContainer}>
        <CameraView ref={cameraRef} style={s.camera} facing="front">
          <SafeAreaView style={s.cameraOverlay}>
            <TouchableOpacity style={s.closeCameraBtn} onPress={() => setCameraMode(false)}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
            <View style={s.faceGuide}><View style={[s.faceGuideOval, { borderColor: colors.primary }]} /><Text style={s.faceGuideText}>Position your face in the oval</Text></View>
            <View style={s.captureContainer}><TouchableOpacity style={[s.captureBtn, { borderColor: colors.primary }]} onPress={capturePhoto}><View style={[s.captureBtnInner, { backgroundColor: colors.primary }]} /></TouchableOpacity></View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.pageTitle, { color: colors.text }]}>Choose Your Analysis</Text>
        <Text style={[s.pageSub, { color: colors.textSecondary }]}>What would you like to know?</Text>

        {/* 3 Mode Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabScrollContent}>
          {([
            { key: 'skin_care' as Mode, icon: 'leaf', label: 'Skin Care', sub: 'Daily routine' },
            { key: 'makeup' as Mode, icon: 'color-palette', label: 'Makeup', sub: 'Blush, lip, eye' },
            { key: 'travel' as Mode, icon: 'airplane', label: 'Travel Style', sub: 'Destination look' },
          ]).map(t => (
            <TouchableOpacity key={t.key} style={[s.modeTab, { backgroundColor: mode === t.key ? colors.surface : 'transparent', borderColor: mode === t.key ? colors.border : 'transparent' }]} onPress={() => { setMode(t.key); setTravelResult(null); }} activeOpacity={0.7}>
              <Ionicons name={t.icon as any} size={20} color={mode === t.key ? colors.primary : colors.textTertiary} />
              <Text style={[s.modeTabLabel, { color: mode === t.key ? colors.text : colors.textTertiary }]}>{t.label}</Text>
              <Text style={[s.modeTabSub, { color: mode === t.key ? colors.textSecondary : colors.textTertiary }]}>{t.sub}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* SKIN CARE / MAKEUP MODES */}
        {(mode === 'skin_care' || mode === 'makeup') && (
          <>
            {/* Mode Info Banner */}
            <View style={[s.infoBanner, { backgroundColor: mode === 'skin_care' ? colors.tertiaryLight : colors.primaryLight, borderColor: (mode === 'skin_care' ? colors.tertiary : colors.primary) + '30' }]}>
              <Ionicons name={mode === 'skin_care' ? 'leaf' : 'color-palette'} size={18} color={mode === 'skin_care' ? colors.tertiary : colors.primary} />
              <Text style={[s.infoBannerText, { color: colors.text }]}>
                {mode === 'skin_care'
                  ? 'Analyze your skin type, concerns, and get a personalized daily skincare routine.'
                  : 'Get tailored blush, lip color, eye makeup, contouring, brow styling, and hair tips based on your unique features.'}
              </Text>
            </View>

            {/* Image Upload */}
            {imageUri ? (
              <View style={s.imgContainer}>
                <Image source={{ uri: imageUri }} style={[s.previewImg, { backgroundColor: colors.surfaceVariant }]} contentFit="cover" />
                <TouchableOpacity style={[s.removeBtn, { backgroundColor: colors.surface }]} onPress={clearImage}><Ionicons name="close-circle" size={32} color={colors.error} /></TouchableOpacity>
              </View>
            ) : (
              <View style={[s.uploadArea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[s.uploadIcon, { backgroundColor: mode === 'skin_care' ? colors.tertiaryLight : colors.primaryLight }]}>
                  <Ionicons name="image-outline" size={40} color={mode === 'skin_care' ? colors.tertiary : colors.primary} />
                </View>
                <Text style={[s.uploadTitle, { color: colors.text }]}>Upload Your Photo</Text>
                <Text style={[s.uploadDesc, { color: colors.textSecondary }]}>{mode === 'skin_care' ? 'Clean face photo for skin analysis' : 'With or without makeup for personalized tips'}</Text>
              </View>
            )}

            {!imageUri ? (
              <View style={s.actionRow}>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={takePhoto}>
                  <View style={[s.actionIcon, { backgroundColor: colors.primaryLight }]}><Ionicons name="camera" size={24} color={colors.primary} /></View>
                  <Text style={[s.actionText, { color: colors.text }]}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={pickImage}>
                  <View style={[s.actionIcon, { backgroundColor: colors.secondaryLight }]}><Ionicons name="images" size={24} color={colors.secondary} /></View>
                  <Text style={[s.actionText, { color: colors.text }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.analyzeRow}>
                <TouchableOpacity style={[s.analyzeBtn, { backgroundColor: mode === 'skin_care' ? colors.tertiary : colors.primary }, analyzing && { opacity: 0.7 }]} onPress={analyzeImage} disabled={analyzing}>
                  <View style={s.analyzeBtnInner}>
                    {analyzing ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name={mode === 'skin_care' ? 'leaf' : 'color-palette'} size={20} color="#FFF" />}
                    <Text style={s.analyzeBtnText}>{analyzing ? 'Analyzing...' : mode === 'skin_care' ? 'Analyze My Skin' : 'Get Makeup Tips'}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearImage} style={s.retakeBtn}><Text style={[s.retakeText, { color: colors.primary }]}>Choose Different Photo</Text></TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* TRAVEL MODE */}
        {mode === 'travel' && (
          <>
            <View style={[s.infoBanner, { backgroundColor: colors.accentLight, borderColor: colors.accent + '30' }]}>
              <Ionicons name="airplane" size={18} color={colors.accent} />
              <Text style={[s.infoBannerText, { color: colors.text }]}>Travelling and not sure what to wear or how to do your makeup? Tell us where, when, and why — we'll style you!</Text>
            </View>

            {/* Country Picker */}
            <TouchableOpacity style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={() => setShowCountryPicker(true)}>
              <Text style={[s.pickerLabel, { color: colors.textSecondary }]}>Destination Country</Text>
              <View style={s.pickerValue}>
                {selectedCountry ? (
                  <Text style={[s.pickerText, { color: colors.text }]}>{COUNTRIES.find(c => c.name === selectedCountry)?.flag}  {selectedCountry}</Text>
                ) : (
                  <Text style={[s.pickerPlaceholder, { color: colors.textTertiary }]}>Select a country...</Text>
                )}
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>

            {/* Month Picker */}
            <TouchableOpacity style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={() => setShowMonthPicker(true)}>
              <Text style={[s.pickerLabel, { color: colors.textSecondary }]}>Month of Travel</Text>
              <View style={s.pickerValue}>
                <Text style={[selectedMonth ? s.pickerText : s.pickerPlaceholder, { color: selectedMonth ? colors.text : colors.textTertiary }]}>{selectedMonth || 'Select month...'}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>

            {/* Occasion */}
            <Text style={[s.sectionLabel, { color: colors.text }]}>Select Occasion</Text>
            <View style={s.occasionGrid}>
              {OCCASIONS.map(o => (
                <TouchableOpacity key={o.label} style={[s.occasionChip, { backgroundColor: selectedOccasion === o.label ? colors.primary : colors.surface, borderColor: selectedOccasion === o.label ? colors.primary : colors.borderLight }]} onPress={() => setSelectedOccasion(o.label)}>
                  <Ionicons name={o.icon as any} size={16} color={selectedOccasion === o.label ? '#FFF' : colors.primary} />
                  <Text style={[s.occasionText, { color: selectedOccasion === o.label ? '#FFF' : colors.text }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Get Suggestions Button */}
            <TouchableOpacity style={[s.analyzeBtn, { backgroundColor: colors.accent, marginTop: 16 }, travelLoading && { opacity: 0.7 }]} onPress={getTravelSuggestions} disabled={travelLoading}>
              <View style={s.analyzeBtnInner}>
                {travelLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="sparkles" size={20} color="#FFF" />}
                <Text style={s.analyzeBtnText}>{travelLoading ? 'Getting your look...' : 'Style Me!'}</Text>
              </View>
            </TouchableOpacity>

            {/* Travel Results */}
            {travelResult && (
              <View style={[s.travelResults, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <Text style={[s.travelResultTitle, { color: colors.text }]}>Your Travel Look</Text>
                {travelResult.destination_info && <Text style={[s.travelInfo, { color: colors.textSecondary }]}>{travelResult.destination_info}</Text>}
                {travelResult.overall_vibe && (
                  <View style={[s.vibeBanner, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="sparkles" size={16} color={colors.primary} />
                    <Text style={[s.vibeText, { color: colors.primary }]}>{travelResult.overall_vibe}</Text>
                  </View>
                )}
                {travelResult.outfit_suggestions?.map((o: any, i: number) => (
                  <View key={i} style={[s.recCard, { borderColor: colors.borderLight }]}>
                    <Text style={[s.recCat, { color: colors.accent }]}>{o.category}</Text>
                    <Text style={[s.recText, { color: colors.text }]}>{o.suggestion}</Text>
                    <Text style={[s.recTips, { color: colors.textSecondary }]}>{o.tips}</Text>
                  </View>
                ))}
                {travelResult.makeup_look?.map((m: any, i: number) => (
                  <View key={i} style={[s.recCard, { borderColor: colors.borderLight }]}>
                    <Text style={[s.recCat, { color: colors.primary }]}>{m.category}</Text>
                    <Text style={[s.recText, { color: colors.text }]}>{m.suggestion}</Text>
                    <Text style={[s.recTips, { color: colors.textSecondary }]}>{m.tips}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Disclaimer */}
        <View style={s.disclaimerRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.textTertiary} />
          <Text style={[s.disclaimerText, { color: colors.textTertiary }]}>{DISCLAIMER}</Text>
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.modalContent, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <View style={[s.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput style={[s.searchInput, { color: colors.text }]} placeholder="Search countries..." placeholderTextColor={colors.textTertiary} value={countrySearch} onChangeText={setCountrySearch} />
            </View>
            <FlatList data={filteredCountries} keyExtractor={i => i.name} renderItem={({ item }) => (
              <TouchableOpacity style={[s.countryRow, { borderBottomColor: colors.borderLight }]} onPress={() => { setSelectedCountry(item.name); setShowCountryPicker(false); setCountrySearch(''); }}>
                <Text style={s.countryFlag}>{item.flag}</Text>
                <Text style={[s.countryName, { color: colors.text }]}>{item.name}</Text>
                {selectedCountry === item.name && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>

      {/* Month Picker Modal */}
      <Modal visible={showMonthPicker} animationType="slide" transparent>
        <View style={[s.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.modalContent, { backgroundColor: colors.background, maxHeight: 400 }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <FlatList data={MONTHS} keyExtractor={i => i} renderItem={({ item }) => (
              <TouchableOpacity style={[s.countryRow, { borderBottomColor: colors.borderLight }]} onPress={() => { setSelectedMonth(item); setShowMonthPicker(false); }}>
                <Text style={[s.countryName, { color: colors.text }]}>{item}</Text>
                {selectedMonth === item && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 110 },
  pageTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  pageSub: { fontSize: 14, marginBottom: 16 },
  // Tabs
  tabScroll: { marginBottom: 16 },
  tabScrollContent: { gap: 8 },
  modeTab: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, minWidth: 105 },
  modeTabLabel: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  modeTabSub: { fontSize: 10, marginTop: 2 },
  // Info Banner
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, marginBottom: 18, borderWidth: 1 },
  infoBannerText: { flex: 1, fontSize: 13, lineHeight: 19 },
  // Upload
  uploadArea: { borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', marginBottom: 18 },
  uploadIcon: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  uploadTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  uploadDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  imgContainer: { position: 'relative', alignItems: 'center', marginBottom: 18 },
  previewImg: { width: '100%', aspectRatio: 1, borderRadius: 20 },
  removeBtn: { position: 'absolute', top: 12, right: 12, borderRadius: 16 },
  // Actions
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  actionBtn: { flex: 1, borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1 },
  actionIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionText: { fontSize: 14, fontWeight: '600' },
  analyzeRow: { gap: 10, marginBottom: 18 },
  analyzeBtn: { borderRadius: 16, padding: 17, alignItems: 'center' },
  analyzeBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  retakeBtn: { padding: 10, alignItems: 'center' },
  retakeText: { fontSize: 14, fontWeight: '600' },
  // Travel
  pickerBtn: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  pickerLabel: { fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerValue: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontSize: 15, fontWeight: '500' },
  pickerPlaceholder: { fontSize: 15 },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 12 },
  occasionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  occasionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1 },
  occasionText: { fontSize: 12, fontWeight: '500' },
  // Travel Results
  travelResults: { borderRadius: 16, padding: 18, marginTop: 20, borderWidth: 1 },
  travelResultTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  travelInfo: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  vibeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 14 },
  vibeText: { flex: 1, fontSize: 13, fontWeight: '600' },
  recCard: { borderBottomWidth: 1, paddingVertical: 12 },
  recCat: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  recText: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  recTips: { fontSize: 12, lineHeight: 17 },
  // Disclaimer
  disclaimerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: 16 },
  disclaimerText: { flex: 1, fontSize: 10, lineHeight: 15 },
  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  closeCameraBtn: { alignSelf: 'flex-start', padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  faceGuide: { alignItems: 'center' },
  faceGuideOval: { width: 220, height: 300, borderRadius: 110, borderWidth: 2, borderStyle: 'dashed' },
  faceGuideText: { color: '#FFF', fontSize: 14, marginTop: 16 },
  captureContainer: { alignItems: 'center', paddingBottom: 20 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(212,132,154,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28 },
  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  countryFlag: { fontSize: 24 },
  countryName: { flex: 1, fontSize: 15 },
});
