import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, TextInput, FlatList, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';
import { MakErrorSheet, MakErrorVariant } from '../../src/components/MakErrorSheet';
import { MakLoadingRotator } from '../../src/components/MakLoadingRotator';
import { MakInfoBanner } from '../../src/components/MakInfoBanner';
import { mapErrorToVariant, AnalyzeMode as LoadingMode } from '../../src/constants/strings';

type Mode = 'skin_care' | 'makeup' | 'travel';
type ICountry = { name: string; isoCode: string; flag: string };
type IState = { name: string; isoCode: string };
type ICity = { name: string };

// ============================================================
// Module-level in-memory cache for location data — populated once per app
// session via the backend API. This avoids re-fetching when the picker is
// re-opened. Memory cost: tiny (~50KB countries + ~5KB per state load +
// ~50KB per city load, only for the country/state the user actually picks).
// ============================================================
let _countriesCache: ICountry[] | null = null;
const _statesCache: Map<string, IState[]> = new Map();
const _citiesCache: Map<string, ICity[]> = new Map();

const DISCLAIMER = 'We respect your privacy and do not store any personal data. Results are for informational purposes only — try at your own discretion.';

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
  // Travel state — using country-state-city library (ISO codes for state/city lookup)
  const [selectedCountry, setSelectedCountry] = useState('');       // display name
  const [selectedCountryCode, setSelectedCountryCode] = useState(''); // isoCode (e.g. 'IN', 'CA')
  const [selectedState, setSelectedState] = useState('');           // display name
  const [selectedStateCode, setSelectedStateCode] = useState('');   // isoCode
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedOccasion, setSelectedOccasion] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [travelResult, setTravelResult] = useState<any>(null);
  const [travelLoading, setTravelLoading] = useState(false);
  // v1.0.6 — Upload-source bottom sheet (Take Photo / Choose from Gallery)
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  // Error sheet state — replaces Alert.alert("Oops!", ...)
  const [errorVariant, setErrorVariant] = useState<MakErrorVariant | null>(null);
  // Track which action triggered the error so Try Again retries the right call
  const [pendingRetryAction, setPendingRetryAction] = useState<'analyze' | 'travel' | null>(null);

  // Re-warmup the backend whenever the Analyze tab is opened — kills cold-start latency
  // (Initial warmup happens at app launch in _layout.tsx; this re-warms if user returns later.)
  useEffect(() => {
    api.warmup().catch(() => {});
  }, []);

  // ============================================================
  // Location data — fetched lazily from backend (was bundled npm library
  // in earlier builds, which added ~7-8MB to the APK).
  // - Countries: fetched once on first open, cached for session
  // - States: fetched once per country, cached
  // - Cities: fetched once per (country, state), cached
  // ============================================================
  const [allCountries, setAllCountries] = useState<ICountry[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [availableStates, setAvailableStates] = useState<IState[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [availableCities, setAvailableCities] = useState<ICity[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // Fetch countries once (only when Travel mode becomes active to keep app launch fast)
  useEffect(() => {
    if (mode !== 'travel') return;
    if (_countriesCache) {
      setAllCountries(_countriesCache);
      return;
    }
    setCountriesLoading(true);
    api.getCountries()
      .then((data) => {
        _countriesCache = data;
        setAllCountries(data);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[locations] failed to load countries:', e);
      })
      .finally(() => setCountriesLoading(false));
  }, [mode]);

  // Fetch states whenever a country is selected
  useEffect(() => {
    if (!selectedCountryCode) {
      setAvailableStates([]);
      return;
    }
    const cached = _statesCache.get(selectedCountryCode);
    if (cached) {
      setAvailableStates(cached);
      return;
    }
    setStatesLoading(true);
    api.getStates(selectedCountryCode)
      .then((data) => {
        _statesCache.set(selectedCountryCode, data);
        setAvailableStates(data);
      })
      .catch(() => setAvailableStates([]))
      .finally(() => setStatesLoading(false));
  }, [selectedCountryCode]);

  // Fetch cities whenever a state is selected
  useEffect(() => {
    if (!selectedCountryCode || !selectedStateCode) {
      setAvailableCities([]);
      return;
    }
    const key = `${selectedCountryCode}|${selectedStateCode}`;
    const cached = _citiesCache.get(key);
    if (cached) {
      setAvailableCities(cached);
      return;
    }
    setCitiesLoading(true);
    api.getCities(selectedCountryCode, selectedStateCode)
      .then((data) => {
        _citiesCache.set(key, data);
        setAvailableCities(data);
      })
      .catch(() => setAvailableCities([]))
      .finally(() => setCitiesLoading(false));
  }, [selectedCountryCode, selectedStateCode]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [countrySearch, allCountries]);

  const filteredStates = useMemo(() => {
    const q = stateSearch.trim().toLowerCase();
    if (!q) return availableStates;
    return availableStates.filter((s) => s.name.toLowerCase().includes(q));
  }, [stateSearch, availableStates]);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return availableCities;
    return availableCities.filter((c) => c.name.toLowerCase().includes(q));
  }, [citySearch, availableCities]);

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
    if (!imageBase64 || !user?.id) {
      // Soft inline error for missing photo (not an LLM failure)
      setErrorVariant('badImage');
      setPendingRetryAction('analyze');
      return;
    }
    setAnalyzing(true);
    setErrorVariant(null);
    try {
      const result = await api.analyzeSkin(imageBase64, user.id, mode);
      router.push({ pathname: '/analysis-result', params: { analysisId: result.id, mode } });
    } catch (err: any) {
      // Map error to a user-friendly variant — never expose status codes
      const variant = mapErrorToVariant(err);
      setErrorVariant(variant);
      setPendingRetryAction('analyze');
    } finally {
      setAnalyzing(false);
    }
  };

  const getTravelSuggestions = async () => {
    if (!selectedCountry || !selectedMonth || !selectedOccasion) {
      Alert.alert('Missing Info', 'Please select country, month, and occasion.');
      return;
    }
    setTravelLoading(true);
    setErrorVariant(null);
    const location = [selectedCity, selectedState, selectedCountry].filter(Boolean).join(', ');
    try {
      const result = await api.getTravelStyle(location, selectedMonth, selectedOccasion, user?.id);
      setTravelResult(result);
    } catch (err: any) {
      const variant = mapErrorToVariant(err);
      setErrorVariant(variant);
      setPendingRetryAction('travel');
    } finally {
      setTravelLoading(false);
    }
  };

  // Map analyze.tsx mode -> loading rotator mode key
  const loadingMode: LoadingMode = mode === 'skin_care' ? 'skinCare' : mode === 'makeup' ? 'makeup' : 'travel';
  const isLoading = analyzing || travelLoading;

  const handleErrorPrimary = () => {
    const action = pendingRetryAction;
    setErrorVariant(null);
    if (action === 'analyze') {
      // For badImage variant, primary CTA is "Choose Another Photo" — clear instead of retry
      if (errorVariant === 'badImage') {
        clearImage();
      } else {
        setTimeout(() => analyzeImage(), 100);
      }
    } else if (action === 'travel') {
      setTimeout(() => getTravelSuggestions(), 100);
    }
  };

  const handleErrorSecondary = () => {
    setErrorVariant(null);
    if (pendingRetryAction === 'analyze') {
      clearImage();
    }
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
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[s.pageTitle, { color: colors.text }]}>Choose Your Analysis</Text>
            <Text style={[s.pageSub, { color: colors.textSecondary }]}>What would you like to know?</Text>
          </View>
        </View>

        {/* 3 Mode Tabs */}
        {/* Mode Tabs — v1.0.6: bolder, bigger, with clearer separation between sections */}
        <View style={[s.tabContainer, { backgroundColor: colors.surfaceVariant }]}>
          {([
            { key: 'skin_care' as Mode, icon: 'leaf', label: 'Skin Care', sub: 'Daily routine' },
            { key: 'makeup' as Mode, icon: 'color-palette', label: 'Makeup', sub: 'Blush, lip, eye' },
            { key: 'travel' as Mode, icon: 'airplane', label: 'Travel Style', sub: 'Destination look' },
          ]).map((t, idx) => (
            <React.Fragment key={t.key}>
              {idx > 0 && <View style={[s.tabDivider, { backgroundColor: colors.border }]} />}
              <TouchableOpacity
                style={[s.modeTab, mode === t.key && { backgroundColor: colors.surface, borderColor: colors.primary + '60' }]}
                onPress={() => { setMode(t.key); setTravelResult(null); }}
                activeOpacity={0.7}
              >
                <View style={[s.modeTabIconBg, { backgroundColor: mode === t.key ? colors.primaryLight : 'transparent' }]}>
                  <Ionicons name={t.icon as any} size={mode === t.key ? 26 : 22} color={mode === t.key ? colors.primary : colors.textTertiary} />
                </View>
                <Text style={[s.modeTabLabel, { color: mode === t.key ? colors.text : colors.textSecondary }]}>{t.label}</Text>
                <Text style={[s.modeTabSub, { color: mode === t.key ? colors.textSecondary : colors.textTertiary }]}>{t.sub}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Persistent first-scan hint banner — only for scan modes (skin_care, makeup).
            Travel mode doesn't take a photo so the "first scan" message would be misleading. */}
        {(mode === 'skin_care' || mode === 'makeup') && (
          <View style={s.infoBannerWrap}>
            <MakInfoBanner />
          </View>
        )}

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

            {/* Image Upload — v1.0.6: single CTA opens a bottom sheet with the
                two source options (Take Photo / Gallery). Used to be 3 buttons
                stacked — now intuitive single tap. */}
            {imageUri ? (
              <>
                <View style={s.imgContainer}>
                  <Image source={{ uri: imageUri }} style={[s.previewImg, { backgroundColor: colors.surfaceVariant }]} contentFit="cover" />
                  <TouchableOpacity style={[s.removeBtn, { backgroundColor: colors.surface }]} onPress={clearImage}><Ionicons name="close-circle" size={32} color={colors.error} /></TouchableOpacity>
                </View>
                <View style={s.analyzeRow}>
                  <TouchableOpacity style={[s.analyzeBtn, { backgroundColor: mode === 'skin_care' ? colors.tertiary : colors.primary }, analyzing && { opacity: 0.7 }]} onPress={analyzeImage} disabled={analyzing}>
                    <View style={s.analyzeBtnInner}>
                      {analyzing ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name={mode === 'skin_care' ? 'leaf' : 'color-palette'} size={20} color="#FFF" />}
                      <Text style={s.analyzeBtnText}>{analyzing ? 'Analyzing...' : mode === 'skin_care' ? 'Analyze My Skin' : 'Get Makeup Tips'}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearImage} style={s.retakeBtn}><Text style={[s.retakeText, { color: colors.primary }]}>Choose Different Photo</Text></TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity
                style={[s.uploadArea, { backgroundColor: colors.surface, borderColor: (mode === 'skin_care' ? colors.tertiary : colors.primary) + '60' }]}
                onPress={() => setShowUploadSheet(true)}
                activeOpacity={0.8}
              >
                <View style={[s.uploadIcon, { backgroundColor: mode === 'skin_care' ? colors.tertiaryLight : colors.primaryLight }]}>
                  <Ionicons name="cloud-upload-outline" size={42} color={mode === 'skin_care' ? colors.tertiary : colors.primary} />
                </View>
                <Text style={[s.uploadTitle, { color: colors.text }]}>Upload Your Photo</Text>
                <Text style={[s.uploadDesc, { color: colors.textSecondary }]}>{mode === 'skin_care' ? 'Take a clean face photo or pick one from your gallery' : 'Take a face photo or pick one — with or without makeup'}</Text>
                <View style={[s.uploadCtaPill, { backgroundColor: (mode === 'skin_care' ? colors.tertiary : colors.primary) + '15', borderColor: (mode === 'skin_care' ? colors.tertiary : colors.primary) + '40' }]}>
                  <Ionicons name="add-circle" size={16} color={mode === 'skin_care' ? colors.tertiary : colors.primary} />
                  <Text style={[s.uploadCtaPillText, { color: mode === 'skin_care' ? colors.tertiary : colors.primary }]}>Tap to choose</Text>
                </View>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* TRAVEL MODE */}
        {mode === 'travel' && (
          <>
            <View style={[s.infoBanner, { backgroundColor: colors.accentLight, borderColor: colors.accent + '30' }]}>
              <Ionicons name="airplane" size={18} color={colors.accent} />
              <Text style={[s.infoBannerText, { color: colors.text }]}>{`Travelling and not sure what to wear or how to do your makeup? Tell us where, when, and why — we'll style you!`}</Text>
            </View>

            {/* Country Picker */}
            <TouchableOpacity style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={() => setShowCountryPicker(true)}>
              <Text style={[s.pickerLabel, { color: colors.textSecondary }]}>Destination Country</Text>
              <View style={s.pickerValue}>
                {selectedCountry ? (
                  <Text style={[s.pickerText, { color: colors.text }]}>{allCountries.find(c => c.name === selectedCountry)?.flag || ''}  {selectedCountry}</Text>
                ) : (
                  <Text style={[s.pickerPlaceholder, { color: colors.textTertiary }]}>Select a country...</Text>
                )}
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>

            {/* State Picker (optional — skipped if country has no states) */}
            <TouchableOpacity style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: selectedCountry ? 1 : 0.5 }]} onPress={() => { if (!selectedCountry) { Alert.alert('Select Country', 'Please select a country first.'); return; } if (availableStates.length === 0) { Alert.alert('No States', 'This country doesn\u2019t have state divisions. We\u2019ll style based on the country.'); return; } setShowStatePicker(true); }} disabled={!selectedCountry}>
              <Text style={[s.pickerLabel, { color: colors.textSecondary }]}>State / Region <Text style={{ color: colors.textTertiary }}>(optional)</Text></Text>
              <View style={s.pickerValue}>
                <Text style={[selectedState ? s.pickerText : s.pickerPlaceholder, { color: selectedState ? colors.text : colors.textTertiary }]}>{selectedState || (availableStates.length === 0 && selectedCountry ? 'Not available' : 'Select state...')}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>

            {/* City Picker (optional) */}
            <TouchableOpacity style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: selectedState ? 1 : 0.5 }]} onPress={() => { if (!selectedState) { Alert.alert('Select State', 'Please select a state/region first, or skip — we can style based on country alone.'); return; } if (availableCities.length === 0) { Alert.alert('No Cities', 'This region doesn\u2019t have city data. We\u2019ll style based on the state.'); return; } setShowCityPicker(true); }} disabled={!selectedState}>
              <Text style={[s.pickerLabel, { color: colors.textSecondary }]}>City <Text style={{ color: colors.textTertiary }}>(optional)</Text></Text>
              <View style={s.pickerValue}>
                <Text style={[selectedCity ? s.pickerText : s.pickerPlaceholder, { color: selectedCity ? colors.text : colors.textTertiary }]}>{selectedCity || (availableCities.length === 0 && selectedState ? 'Not available' : 'Select city...')}</Text>
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
            {(() => {
              // Required: Country + Month + Occasion. State/City are optional (some countries have no states).
              const missing = [];
              if (!selectedCountry) missing.push('Country');
              if (!selectedMonth) missing.push('Month');
              if (!selectedOccasion) missing.push('Occasion');
              const canSubmit = missing.length === 0;
              return (
                <>
                  {missing.length > 0 && (
                    <View style={s.helperRow}>
                      <Ionicons name="information-circle" size={14} color={colors.error} />
                      <Text style={[s.helperText, { color: colors.error }]}>Please select: {missing.join(', ')}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={[s.analyzeBtn, { backgroundColor: colors.accent, marginTop: 8, opacity: canSubmit ? 1 : 0.4 }]} onPress={getTravelSuggestions} disabled={!canSubmit || travelLoading}>
                    <View style={s.analyzeBtnInner}>
                      {travelLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="sparkles" size={20} color="#FFF" />}
                      <Text style={s.analyzeBtnText}>{travelLoading ? 'Getting your look...' : 'Style Me!'}</Text>
                    </View>
                  </TouchableOpacity>
                </>
              );
            })()}

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

      {/* Upload-source Bottom Sheet (Take Photo / Choose from Gallery)
          v1.0.6: replaces the old 2-button row for a more intuitive flow. */}
      <Modal visible={showUploadSheet} animationType="slide" transparent onRequestClose={() => setShowUploadSheet(false)}>
        <Pressable style={[s.uploadSheetOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowUploadSheet(false)}>
          <Pressable style={[s.uploadSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
            <View style={s.uploadSheetHandle} />
            <View style={s.uploadSheetHeader}>
              <Text style={[s.uploadSheetTitle, { color: colors.text }]}>Add a photo</Text>
              <Text style={[s.uploadSheetSubtitle, { color: colors.textSecondary }]}>How would you like to upload your photo?</Text>
            </View>
            <TouchableOpacity
              style={[s.uploadOption, { backgroundColor: colors.surfaceVariant, borderColor: colors.borderLight }]}
              onPress={() => { setShowUploadSheet(false); takePhoto(); }}
              activeOpacity={0.85}
            >
              <View style={[s.uploadOptionIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="camera" size={26} color={colors.primary} />
              </View>
              <View style={s.uploadOptionText}>
                <Text style={[s.uploadOptionTitle, { color: colors.text }]}>Take Photo</Text>
                <Text style={[s.uploadOptionDesc, { color: colors.textSecondary }]}>Use your camera now</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.uploadOption, { backgroundColor: colors.surfaceVariant, borderColor: colors.borderLight }]}
              onPress={() => { setShowUploadSheet(false); pickImage(); }}
              activeOpacity={0.85}
            >
              <View style={[s.uploadOptionIcon, { backgroundColor: colors.secondaryLight }]}>
                <Ionicons name="images" size={26} color={colors.secondary} />
              </View>
              <View style={s.uploadOptionText}>
                <Text style={[s.uploadOptionTitle, { color: colors.text }]}>Choose from Gallery</Text>
                <Text style={[s.uploadOptionDesc, { color: colors.textSecondary }]}>Pick from your photos</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowUploadSheet(false)} style={s.uploadSheetCancel}>
              <Text style={[s.uploadSheetCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent onRequestClose={() => { setShowCountryPicker(false); setCountrySearch(''); }}>
        <Pressable style={[s.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}>
          <Pressable style={[s.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Select Country</Text>
              <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <View style={[s.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput style={[s.searchInput, { color: colors.text }]} placeholder="Search countries..." placeholderTextColor={colors.textTertiary} value={countrySearch} onChangeText={setCountrySearch} />
            </View>
            {countriesLoading && allCountries.length === 0 ? (
              <View style={s.emptyListWrap}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[s.emptyListText, { color: colors.textSecondary }]}>Loading countries...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredCountries}
                keyExtractor={(i) => i.isoCode}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                windowSize={10}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[s.countryRow, { borderBottomColor: colors.borderLight }]}
                    onPress={() => {
                      setSelectedCountry(item.name);
                      setSelectedCountryCode(item.isoCode);
                      // Reset state/city when country changes
                      setSelectedState('');
                      setSelectedStateCode('');
                      setSelectedCity('');
                      setStateSearch('');
                      setCitySearch('');
                      setShowCountryPicker(false);
                      setCountrySearch('');
                    }}
                  >
                    <Text style={s.countryFlag}>{item.flag}</Text>
                    <Text style={[s.countryName, { color: colors.text }]}>{item.name}</Text>
                    {selectedCountry === item.name && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Month Picker Modal */}
      <Modal visible={showMonthPicker} animationType="slide" transparent onRequestClose={() => setShowMonthPicker(false)}>
        <Pressable style={[s.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowMonthPicker(false)}>
          <Pressable style={[s.modalContent, { backgroundColor: colors.background, maxHeight: 400 }]} onPress={() => {}}>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* State Picker Modal */}
      <Modal visible={showStatePicker} animationType="slide" transparent onRequestClose={() => { setShowStatePicker(false); setStateSearch(''); }}>
        <Pressable style={[s.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => { setShowStatePicker(false); setStateSearch(''); }}>
          <Pressable style={[s.modalContent, { backgroundColor: colors.background, maxHeight: 420 }]} onPress={() => {}}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Select State / Region</Text>
              <TouchableOpacity onPress={() => { setShowStatePicker(false); setStateSearch(''); }}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <View style={[s.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput style={[s.searchInput, { color: colors.text }]} placeholder="Search states..." placeholderTextColor={colors.textTertiary} value={stateSearch} onChangeText={setStateSearch} />
            </View>
            {statesLoading ? (
              <View style={s.emptyListWrap}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[s.emptyListText, { color: colors.textSecondary }]}>Loading states...</Text>
              </View>
            ) : availableStates.length === 0 ? (
              <View style={s.emptyListWrap}>
                <Ionicons name="information-circle-outline" size={28} color={colors.textTertiary} />
                <Text style={[s.emptyListText, { color: colors.textSecondary }]}>No states available for this country. You can still style by country alone.</Text>
              </View>
            ) : (
              <FlatList
                data={filteredStates}
                keyExtractor={(i) => i.isoCode}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                windowSize={10}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[s.countryRow, { borderBottomColor: colors.borderLight }]}
                    onPress={() => {
                      setSelectedState(item.name);
                      setSelectedStateCode(item.isoCode);
                      // Reset city when state changes
                      setSelectedCity('');
                      setCitySearch('');
                      setShowStatePicker(false);
                      setStateSearch('');
                    }}
                  >
                    <Ionicons name="location-outline" size={20} color={colors.secondary} />
                    <Text style={[s.countryName, { color: colors.text }]}>{item.name}</Text>
                    {selectedState === item.name && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* City Picker Modal */}
      <Modal visible={showCityPicker} animationType="slide" transparent onRequestClose={() => { setShowCityPicker(false); setCitySearch(''); }}>
        <Pressable style={[s.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => { setShowCityPicker(false); setCitySearch(''); }}>
          <Pressable style={[s.modalContent, { backgroundColor: colors.background, maxHeight: 420 }]} onPress={() => {}}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Select City</Text>
              <TouchableOpacity onPress={() => { setShowCityPicker(false); setCitySearch(''); }}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <View style={[s.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput style={[s.searchInput, { color: colors.text }]} placeholder="Search cities..." placeholderTextColor={colors.textTertiary} value={citySearch} onChangeText={setCitySearch} />
            </View>
            {citiesLoading ? (
              <View style={s.emptyListWrap}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[s.emptyListText, { color: colors.textSecondary }]}>Loading cities...</Text>
              </View>
            ) : availableCities.length === 0 ? (
              <View style={s.emptyListWrap}>
                <Ionicons name="information-circle-outline" size={28} color={colors.textTertiary} />
                <Text style={[s.emptyListText, { color: colors.textSecondary }]}>No cities available for this state. You can still style by state alone.</Text>
              </View>
            ) : (
              <FlatList
                data={filteredCities}
                keyExtractor={(i, idx) => `${i.name}-${idx}`}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={25}
                windowSize={10}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[s.countryRow, { borderBottomColor: colors.borderLight }]}
                    onPress={() => {
                      setSelectedCity(item.name);
                      setShowCityPicker(false);
                      setCitySearch('');
                    }}
                  >
                    <Ionicons name="business-outline" size={20} color={colors.tertiary} />
                    <Text style={[s.countryName, { color: colors.text }]}>{item.name}</Text>
                    {selectedCity === item.name && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
      {/* Full-screen loading overlay — shown during analyze/travel */}
      <Modal visible={isLoading} transparent animationType="fade" statusBarTranslucent>
        <View style={[s.loadingOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.loadingCard, { backgroundColor: colors.surface }]}>
            <MakLoadingRotator mode={loadingMode} />
          </View>
        </View>
      </Modal>

      {/* Error sheet — replaces the old Alert.alert("Oops!", ...) */}
      <MakErrorSheet
        visible={errorVariant !== null}
        variant={errorVariant ?? 'generic'}
        onClose={() => setErrorVariant(null)}
        onPrimaryPress={handleErrorPrimary}
        onSecondaryPress={handleErrorSecondary}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 110 },
  pageTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  pageSub: { fontSize: 14, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  // Tabs — v1.0.6 redesign: each mode is now visually larger and bolder
  // with a distinct active-state border and icon background.
  tabContainer: { flexDirection: 'row', borderRadius: 18, padding: 6, marginBottom: 18, overflow: 'hidden', gap: 4 },
  tabDivider: { width: 0, marginVertical: 0 },
  modeTab: { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  modeTabIconBg: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  modeTabLabel: { fontSize: 14, fontWeight: '800', textAlign: 'center', letterSpacing: 0.3 },
  modeTabSub: { fontSize: 10, marginTop: 3, textAlign: 'center', fontWeight: '500' },
  // Upload area — v1.0.6: single-tap CTA opens bottom sheet
  uploadCtaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginTop: 14 },
  uploadCtaPillText: { fontSize: 13, fontWeight: '600' },
  // Upload-source bottom sheet
  uploadSheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  uploadSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1 },
  uploadSheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 16 },
  uploadSheetHeader: { alignItems: 'center', marginBottom: 18 },
  uploadSheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  uploadSheetSubtitle: { fontSize: 13, textAlign: 'center' },
  uploadOption: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  uploadOptionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  uploadOptionText: { flex: 1 },
  uploadOptionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  uploadOptionDesc: { fontSize: 12 },
  uploadSheetCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  uploadSheetCancelText: { fontSize: 14, fontWeight: '500' },
  // Info Banner
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, marginBottom: 18, borderWidth: 1 },
  infoBannerText: { flex: 1, fontSize: 13, lineHeight: 19 },
  infoBannerWrap: { marginBottom: 18 },
  // Loading Overlay
  loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  loadingCard: { width: '100%', maxWidth: 380, borderRadius: 24, paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12 },
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
  // Helper
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  helperText: { fontSize: 12, fontWeight: '500' },
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
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 60 },
  modalContent: { borderRadius: 20, padding: 20, flex: 1, maxHeight: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  countryFlag: { fontSize: 24 },
  countryName: { flex: 1, fontSize: 15 },
  emptyListWrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyListText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
