import { showAlert } from '@/utils/alert';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Switch, KeyboardAvoidingView, Platform, Image, Keyboard, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabInset } from '@/constants/theme';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import LoginScreen from '@/components/LoginScreen';
import DateTimePicker from '@/components/DateTimePicker';
import { useAuth } from '@/contexts/AuthContext';
import { checkActiveRidesLimit } from '@/utils/rideLimits';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function PublishScreen() {
  const router = useRouter();
  const { user: authUser, loading } = useAuth();
  const isLoggedIn = !!authUser;
  const [showLogin, setShowLogin] = useState(false);
  const [step, setStep] = useState(1);
  const [recentPublished, setRecentPublished] = useState<any[]>([]);
  
  React.useEffect(() => {
    if (isLoggedIn && showLogin) {
      setShowLogin(false);
    }
  }, [isLoggedIn, showLogin]);

  React.useEffect(() => {
    loadRecentPublished();
  }, []);

  const loadRecentPublished = async () => {
    try {
      const stored = await AsyncStorage.getItem('recentPublishedRides');
      if (stored) setRecentPublished(JSON.parse(stored));
    } catch (e) {
    }
  };

  const [formData, setFormData] = useState({
    from: '',
    fromLat: '',
    fromLon: '',
    to: '',
    toLat: '',
    toLon: '',
    date: '',
    time: '',
    price: '',
    carModel: '',
    womenOnly: false,
    seatsAvailable: 3,
  });

  let isStepValid = false;
  if (step === 1) {
    isStepValid = formData.from.trim() !== '' && formData.to.trim() !== '' && formData.fromLat !== '' && formData.toLat !== '';
  }
  if (step === 2) {
    isStepValid = formData.date.trim() !== '' && formData.time.trim() !== '';
  }

  const getLocalYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getCurrentHM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleGetCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude.toString();
      const lon = location.coords.longitude.toString();
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
      const data = await res.json();
      
      let cityName = 'Current Location';
      if (data && data.address) {
        cityName = data.address.city || data.address.town || data.address.state || 'Current Location';
      }
      setFormData({ ...formData, from: cityName, fromLat: lat, fromLon: lon });
    } catch (e) {
      Alert.alert('Error', 'Could not get current location');
    }
  };

  if (step === 3) {
    const isPriceValid = formData.price.trim() !== '' && !isNaN(Number(formData.price)) && Number(formData.price) > 0;
    isStepValid = isPriceValid && formData.carModel.trim() !== '';
  }

  const nextStep = () => {
    if (step === 1 && formData.from.toLowerCase().trim() === formData.to.toLowerCase().trim()) {
      Alert.alert('Invalid Route', 'Origin and destination cannot be the same. Please choose a different destination.');
      return;
    }
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  if (showLogin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowLogin(false)} style={{ position: 'absolute', left: 24, top: 20, zIndex: 10 }}>
            <Feather name="arrow-left" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
        <LoginScreen asComponent={false} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create your ride</Text>
          <View style={styles.progressContainer}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBar, { width: `${(step / 3) * 100}%` }]}
            />
          </View>
          <Text style={styles.stepText}>STEP {step} OF 3</Text>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Promo Banner */}
          <LinearGradient
            colors={['#0A1128', '#1E293B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promoBanner}
          >
            <Image source={{ uri: 'https://flagcdn.com/w40/in.png' }} style={styles.promoIconImg} />
            <Text style={styles.promoText} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={{ color: '#FF9933' }}>PURELY MADE </Text>
              <Text style={{ color: '#FFFFFF' }}>IN INDIA, MADE FOR </Text>
              <Text style={{ color: '#10B981' }}>INDIA</Text>
            </Text>
          </LinearGradient>

          <View style={styles.card}>
            {step === 1 && (
              <View style={[styles.stepContainer, { zIndex: 99, overflow: 'visible' }]}>
                <Text style={styles.stepTitle}>Confirm your route</Text>
                
                <View style={{ flexDirection: 'row', paddingTop: 8 }}>
                  {/* Left Timeline */}
                  <View style={{ width: 24, alignItems: 'center', marginRight: 12, marginTop: 16, marginBottom: 24 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', zIndex: 2 }} />
                    <View style={{ width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 4, zIndex: 1 }} />
                    <View style={{ width: 12, height: 12, backgroundColor: '#EF4444', zIndex: 2 }} />
                  </View>

                  {/* Right Fields (From & To) */}
                  <View style={{ flex: 1 }}>
                    <View style={{ zIndex: 40, elevation: 40, paddingBottom: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[styles.label, { marginBottom: 0 }]}>From</Text>
                        <TouchableOpacity onPress={handleGetCurrentLocation}>
                          <Text style={{ fontSize: 12, color: '#10B981', fontFamily: 'Outfit_600SemiBold' }}>📍 Use Current Location</Text>
                        </TouchableOpacity>
                      </View>
                      <LocationAutocomplete
                        placeholder="City, station or precise address"
                        value={formData.from}
                        onChange={(val, lat, lon) => setFormData({ ...formData, from: val, fromLat: lat || '', fromLon: lon || '' })}
                      />
                    </View>
                    
                    <View style={{ height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 }} />

                    <View style={{ zIndex: 20, elevation: 20, paddingBottom: 8 }}>
                      <Text style={[styles.label, { marginBottom: 4 }]}>To</Text>
                      <LocationAutocomplete
                        placeholder="City, station or precise address"
                        value={formData.to}
                        onChange={(val, lat, lon) => setFormData({ ...formData, to: val, toLat: lat || '', toLon: lon || '' })}
                      />
                    </View>
                  </View>

                  {/* Swap Button (Inline) */}
                  <View style={{ position: 'absolute', right: 0, top: '50%', marginTop: -20, zIndex: 50, elevation: 50 }}>
                    <TouchableOpacity 
                      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}
                      activeOpacity={0.7}
                      onPress={() => {
                        setFormData(prev => ({
                          ...prev,
                          from: prev.to,
                          fromLat: prev.toLat,
                          fromLon: prev.toLon,
                          to: prev.from,
                          toLat: prev.fromLat,
                          toLon: prev.fromLon
                        }));
                      }}
                    >
                      <Feather name="repeat" size={18} color="#4B5563" style={{ transform: [{ rotate: '90deg' }] }} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={[styles.stepContainer, { zIndex: 99, overflow: 'visible' }]}>
                <Text style={styles.stepTitle}>When are you going?</Text>
                
                <View style={{ flexDirection: 'row', zIndex: 10, elevation: 10 }}>
                  {/* Date */}
                  <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#E5E7EB', paddingRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Feather name="calendar" size={14} color="#6B7280" style={{ marginRight: 6 }} />
                      <Text style={[styles.label, { marginBottom: 0 }]}>Date</Text>
                    </View>
                    <View style={{ marginTop: 0, marginLeft: -16 }}>
                      <DateTimePicker
                        type="date"
                        placeholder="dd-mm-yyyy"
                        value={formData.date}
                        onChange={(val) => setFormData({ ...formData, date: val })}
                        min={getLocalYMD()}
                      />
                    </View>
                  </View>

                  {/* Time */}
                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Feather name="clock" size={14} color="#6B7280" style={{ marginRight: 6 }} />
                      <Text style={[styles.label, { marginBottom: 0 }]}>Time</Text>
                    </View>
                    <View style={{ marginTop: 0, marginLeft: -16 }}>
                      <DateTimePicker
                        type="time"
                        placeholder="Travel time"
                        value={formData.time}
                        onChange={(val) => setFormData({ ...formData, time: val })}
                        min={formData.date === getLocalYMD() ? getCurrentHM() : undefined}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {step === 3 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepTitle}>Price and Details</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Price per seat (₹)</Text>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.rupeeIcon}>₹</Text>
                      <TextInput
                        style={[styles.input, { paddingLeft: 30 }]}
                        placeholder="e.g. 1500"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={formData.price}
                        onChangeText={(text) => setFormData({ ...formData, price: text })}
                        maxLength={10}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Car model</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Maruti Swift, Tata Nexon"
                        placeholderTextColor="#9CA3AF"
                        value={formData.carModel}
                        onChangeText={(text) => setFormData({ ...formData, carModel: text })}
                        maxLength={50}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Available seats</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <TouchableOpacity
                        onPress={() => setFormData({ ...formData, seatsAvailable: Math.max(1, formData.seatsAvailable - 1) })}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                        activeOpacity={0.7}
                      >
                        <Feather name="minus" size={24} color={formData.seatsAvailable > 1 ? "#111827" : "#D1D5DB"} />
                      </TouchableOpacity>
                      
                      <Text style={{ fontSize: 24, fontFamily: 'Outfit_600SemiBold', color: '#111827', minWidth: 60, textAlign: 'center' }}>
                        {formData.seatsAvailable}
                      </Text>

                      <TouchableOpacity
                        onPress={() => setFormData({ ...formData, seatsAvailable: Math.min(6, formData.seatsAvailable + 1) })}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                        activeOpacity={0.7}
                      >
                        <Feather name="plus" size={24} color={formData.seatsAvailable < 6 ? "#111827" : "#D1D5DB"} />
                      </TouchableOpacity>
                    </View>
                  </View>


                  <View style={styles.womenOnlyCard}>
                    <View style={styles.womenOnlyInfo}>
                      <View style={styles.womenOnlyTitleRow}>
                        <Feather name="shield" size={16} color="#DB2777" />
                        <Text style={styles.womenOnlyTitle}>Women-Only Ride</Text>
                      </View>
                      <Text style={styles.womenOnlySubtitle}>Only female passengers can book</Text>
                    </View>
                    <Switch
                      value={formData.womenOnly}
                      onValueChange={(val) => setFormData({ ...formData, womenOnly: val })}
                      trackColor={{ false: '#E5E7EB', true: '#EC4899' }}
                    />
                  </View>
                </View>
            )}
          </View>

          <View style={[styles.actions, { marginTop: 16 }]}>
            {step > 1 && (
              <TouchableOpacity style={styles.backButton} onPress={prevStep}>
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[
                step === 1 ? { width: '100%' } : { flex: 1 },
                !isStepValid && { opacity: 0.5 },
                { overflow: 'hidden', borderRadius: 12 }
              ]} 
              onPress={async () => {
                if (step === 3) {
                  if (!isLoggedIn) {
                    setShowLogin(true);
                  } else {
                    if (authUser) {
                      const canProceed = await checkActiveRidesLimit(authUser.uid);
                      if (!canProceed) return;
                    }

                    showAlert("Notification", 'Ride Published!');
                    
                    // Save to recent
                    let updatedRides = recentPublished.filter(r => !(r.from === formData.from && r.to === formData.to));
                    updatedRides = [formData, ...updatedRides].slice(0, 3);
                    setRecentPublished(updatedRides);
                    try {
                      await AsyncStorage.setItem('recentPublishedRides', JSON.stringify(updatedRides));
                    } catch (e) {
                    }
                    // Save to Firebase
                    try {
                      await addDoc(collection(db, 'rides'), {
                        ...formData,
                        price: Number(formData.price), // Convert string to number for Firestore rules
                        status: 'PUBLISHED',
                        driverId: authUser.uid,
                        driverName: authUser.displayName,
                        createdAt: new Date().toISOString(),
                      });
                    } catch (e: any) {
                      console.error("Firebase AddDoc Error: ", e);
                      showAlert("Error", "Failed to publish ride to server. " + e.message);
                      return;
                    }

                    setStep(1);
                    setFormData({
                      from: '',
                      fromLat: '',
                      fromLon: '',
                      to: '',
                      toLat: '',
                      toLon: '',
                      date: '',
                      time: '',
                      price: '',
                      carModel: '',
                      womenOnly: false,
                      seatsAvailable: 3,
                    });
                    router.replace('/rides');
                  }
                } else {
                  if (step === 2) {
                    const todayYMD = getLocalYMD();
                    const currentHM = getCurrentHM();

                    // Normalize date: convert ISO UTC string to local YYYY-MM-DD
                    let normalizedDate = formData.date;
                    if (formData.date && (formData.date.includes('T') || formData.date.endsWith('Z'))) {
                      const d = new Date(formData.date);
                      if (!isNaN(d.getTime())) {
                        normalizedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      }
                    }


                    if (normalizedDate < todayYMD) {
                      showAlert("Notification", 'Please select today or a future date.');
                      return;
                    }

                    if (normalizedDate === todayYMD && formData.time < currentHM) {
                      showAlert("Notification", 'Please select a future time for today.');
                      return;
                    }
                  }
                  if (isStepValid) nextStep();
                }
              }}
              disabled={!isStepValid}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.continueButton}
              >
                <Text style={styles.continueButtonText}>
                  {step === 3 ? (isLoggedIn ? 'Publish Ride' : 'Log in to publish') : 'Continue'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {step === 1 && recentPublished.length > 0 && (
            <View style={{ width: '100%', marginTop: 24 }}>
              <View style={styles.recentHeaderContainer}>
                <Text style={styles.recentTitle}>RECENTLY PUBLISHED</Text>
              </View>

              {recentPublished.map((ride, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.recentCard} 
                  onPress={() => setFormData({ ...ride, seatsAvailable: ride.seatsAvailable || 3 })}
                >
                  <Feather name="check-circle" size={20} color="#10B981" style={styles.recentIcon} />
                  <View style={styles.recentInfo}>
                    <View style={styles.recentRoute}>
                      <Text style={styles.recentCity}>{ride.from}</Text>
                      <Feather name="arrow-right" size={14} color="#9CA3AF" style={styles.routeArrow} />
                      <Text style={styles.recentCity}>{ride.to}</Text>
                    </View>
                    <Text style={styles.recentDetails}>₹{ride.price} • {ride.carModel}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
  },
  stepText: {
    textAlign: 'right',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#6B7280',
    letterSpacing: 1,
  },
  scrollContainer: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    zIndex: 100, // Ensure dropdowns overflow and render above siblings
  },
  stepContainer: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#4B5563',
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    position: 'relative',
  },
  autocompleteWrapper: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: '#111827',
  },
  rupeeIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#6B7280',
    zIndex: 10,
  },
  womenOnlyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FDF2F8',
    borderWidth: 2,
    borderColor: '#FCE7F3',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  womenOnlyInfo: {
    flex: 1,
  },
  womenOnlyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  womenOnlyTitle: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#BE185D',
    marginLeft: 6,
  },
  womenOnlySubtitle: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    width: '33%',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  continueButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  recentHeaderContainer: {
    alignSelf: 'stretch',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  recentTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#4B5563',
    letterSpacing: 1,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  recentIcon: {
    marginRight: 16,
  },
  recentInfo: {
    flex: 1,
  },
  recentRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recentCity: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  routeArrow: {
    marginHorizontal: 8,
  },
  recentDetails: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Outfit_500Medium',
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12, 
    borderRadius: 50,
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  promoIconImg: {
    width: 32, 
    height: 22,
    marginRight: 8,
    borderRadius: 2,
  },
  promoText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    lineHeight: 18,
    flexShrink: 1,
  },
});
