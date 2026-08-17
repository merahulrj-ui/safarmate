import { showAlert } from '@/utils/alert';
import React from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { BottomTabInset } from '@/constants/theme';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@/components/DateTimePicker';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface RecentSearch {
  from: string;
  fromLat?: string;
  fromLon?: string;
  to: string;
  toLat?: string;
  toLon?: string;
  date: string;
  passengers: number;
}

export default function HomeScreen() {
  const [from, setFrom] = React.useState('');
  const [fromLat, setFromLat] = React.useState('');
  const [fromLon, setFromLon] = React.useState('');
  const [to, setTo] = React.useState('');
  const [toLat, setToLat] = React.useState('');
  const [toLon, setToLon] = React.useState('');
  const [recentSearches, setRecentSearches] = React.useState<RecentSearch[]>([]);
  const router = useRouter();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [passengers, setPassengers] = React.useState(1);

  const getTodayYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [searchDate, setSearchDate] = React.useState(getTodayYMD());

  React.useEffect(() => {
    loadRecentSearches();
    
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [user]);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem('recentSearches');
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch (e) {
    }
  };

  const handleGetCurrentLocation = async (setFieldValue: (val: string) => void, setLatValue: (val: string) => void, setLonValue: (val: string) => void) => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude.toString();
      const lon = location.coords.longitude.toString();
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`, {
        headers: {
          'User-Agent': 'SafarMile/1.0'
        }
      });
      const data = await res.json();
      
      let cityName = 'Current Location';
      if (data && data.address) {
        cityName = data.address.city || data.address.town || data.address.state || 'Current Location';
      }
      setFieldValue(cityName);
      setLatValue(lat);
      setLonValue(lon);
    } catch (e) {
      Alert.alert('Error', 'Could not get current location');
    }
  };

  const handleSearch = async () => {
    if (!from || !to || !searchDate) {
      Alert.alert('Missing Fields', 'Please fill in all details');
      return;
    }

    if (from.toLowerCase().trim() === to.toLowerCase().trim()) {
      Alert.alert('Invalid Route', 'Origin and destination cannot be the same. Please choose a different destination.');
      return;
    }

    if (!fromLat || !toLat) {
      showAlert("Notification", 'Security Alert: Please select a valid location from the dropdown suggestions.');
      return;
    }

    const todayYMD = getTodayYMD();
    let normalizedDate = searchDate;
    if (searchDate && (searchDate.includes('T') || searchDate.endsWith('Z'))) {
      const d = new Date(searchDate);
      if (!isNaN(d.getTime())) {
        normalizedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }


    if (normalizedDate < todayYMD) {
      showAlert("Notification", 'BLOCKED: Past date detected. Please select today or a future date for your search.');
      return;
    }

    const newSearch: RecentSearch = { 
      from, 
      fromLat, 
      fromLon, 
      to, 
      toLat, 
      toLon, 
      date: normalizedDate || 'Today', 
      passengers
    };
    
    // Check for duplicates
    let updatedSearches = recentSearches.filter(s => !(s.from === from && s.to === to));
    updatedSearches = [newSearch, ...updatedSearches].slice(0, 3); // Keep only top 3
    
    setRecentSearches(updatedSearches);
    try {
      await AsyncStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
    } catch (e) {
    }
    
    router.push({
      pathname: '/search-results',
      params: { 
        from, 
        to, 
        date: normalizedDate,
        fromLat,
        fromLon,
        toLat,
        toLon,
        passengers: passengers.toString()
      }
    });
  };

  const handleRecentClick = (search: RecentSearch) => {
    setFrom(search.from);
    if (search.fromLat) setFromLat(search.fromLat);
    if (search.fromLon) setFromLon(search.fromLon);
    setTo(search.to);
    if (search.toLat) setToLat(search.toLat);
    if (search.toLon) setToLon(search.toLon);
    if (search.passengers) setPassengers(search.passengers);
    
    if (search.date && search.date !== 'Today') {
      const todayYMD = getTodayYMD();
      let normalizedDate = search.date;
      if (search.date.includes('T') || search.date.endsWith('Z')) {
        const d = new Date(search.date);
        if (!isNaN(d.getTime())) {
          normalizedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }
      
      if (normalizedDate < todayYMD) {
        setSearchDate(todayYMD);
      } else {
        setSearchDate(normalizedDate);
      }
    } else {
      setSearchDate(getTodayYMD());
    }
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString || dateString === 'Today') return 'Today';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })}, ${d.getFullYear()}`;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 4, width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ marginRight: 12, justifyContent: 'center', alignItems: 'center' }}>
              <Image 
                source={require('../../assets/images/icon.png')} 
                style={{ width: 44, height: 44, resizeMode: 'contain' }} 
              />
            </View>
            <Text style={styles.logoText}>
              <Text style={{ color: '#0A1128' }}>Safar</Text>
              <Text style={{ color: '#10B981' }}>Mile</Text>
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={() => {
              if (!user) {
                showAlert("Notification", 'Please login to view notifications');
              } else {
                router.push('/notifications' as any);
              }
            }} 
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="bell" size={22} color="#4B5563" />
            {unreadCount > 0 && (
              <View style={{ position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
            )}
          </TouchableOpacity>
          </View>
        </View>

        {/* Promo Banner */}
        <LinearGradient
          colors={['#0A1128', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoBanner}
        >
          <Image source={{ uri: 'https://flagcdn.com/w40/in.png' }} style={styles.promoIconImg} />
          <Text style={styles.promoText} numberOfLines={1} adjustsFontSizeToFit>
            <Text style={{ color: '#FF9933' }}>PROUDLY MADE </Text>
            <Text style={{ color: '#FFFFFF' }}>IN INDIA, MADE FOR </Text>
            <Text style={{ color: '#10B981' }}>INDIA</Text>
          </Text>
        </LinearGradient>

        {/* Ad-Free Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 24, alignSelf: 'center', borderWidth: 1, borderColor: '#D1FAE5' }}>
          <Feather name="shield" size={14} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 12, fontFamily: 'Outfit_700Bold', color: '#059669', letterSpacing: 0.5 }}>PROUDLY AD-FREE</Text>
        </View>

        {/* Main Title */}
        <Text style={styles.mainTitle}>Find a ride</Text>

        {/* Search Card */}
        <View style={[styles.searchCard, { zIndex: 99, elevation: 10 }]}>
          {/* Location Section */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16 }}>
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
                  <Text style={[styles.inputLabel, { marginBottom: 0 }]}>Leaving from</Text>
                  <TouchableOpacity onPress={() => handleGetCurrentLocation(setFrom, setFromLat, setFromLon)}>
                    <Text style={{ fontSize: 12, color: '#10B981', fontFamily: 'Outfit_600SemiBold' }}>📍 Use Current Location</Text>
                  </TouchableOpacity>
                </View>
                <LocationAutocomplete
                  placeholder="City, station, place"
                  value={from}
                  onChange={(val, lat, lon) => {
                    setFrom(val);
                    if (lat) setFromLat(lat);
                    if (lon) setFromLon(lon);
                  }}
                />
              </View>
              
              <View style={{ height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 }} />

              <View style={{ zIndex: 20, elevation: 20, paddingBottom: 16 }}>
                <Text style={[styles.inputLabel, { marginBottom: 4 }]}>Going to</Text>
                <LocationAutocomplete
                  placeholder="City, station, place"
                  value={to}
                  onChange={(val, lat, lon) => {
                    setTo(val);
                    if (lat) setToLat(lat);
                    if (lon) setToLon(lon);
                  }}
                />
              </View>
            </View>

            {/* Swap Button (Inline) */}
            <View style={{ position: 'absolute', right: 20, top: '50%', marginTop: -20, zIndex: 50, elevation: 50 }}>
              <TouchableOpacity 
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}
                activeOpacity={0.7}
                onPress={() => {
                  const tempFrom = from;
                  const tempFromLat = fromLat;
                  const tempFromLon = fromLon;
                  setFrom(to);
                  setFromLat(toLat);
                  setFromLon(toLon);
                  setTo(tempFrom);
                  setToLat(tempFromLat);
                  setToLon(tempFromLon);
                }}
              >
                <Feather name="repeat" size={18} color="#4B5563" style={{ transform: [{ rotate: '90deg' }] }} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: '#E5E7EB' }} />

          {/* Date & Passengers Row (Split View) */}
          <View style={{ flexDirection: 'row', zIndex: 10, elevation: 10 }}>
            {/* Date */}
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#E5E7EB', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Feather name="calendar" size={14} color="#6B7280" style={{ marginRight: 6 }} />
                <Text style={[styles.inputLabel, { marginBottom: 0 }]}>Date</Text>
              </View>
              <View style={{ marginTop: 0, marginLeft: -16 }}>
                <DateTimePicker
                  type="date"
                  value={searchDate}
                  onChange={setSearchDate}
                  min={getTodayYMD()}
                  placeholder="Today"
                />
              </View>
            </View>

            {/* Passengers */}
            <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Feather name="users" size={14} color="#6B7280" style={{ marginRight: 6 }} />
                <Text style={[styles.inputLabel, { marginBottom: 0 }]}>Passengers</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => setPassengers(Math.max(1, passengers - 1))}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.7}
                >
                  <Feather name="minus" size={16} color={passengers > 1 ? "#111827" : "#D1D5DB"} />
                </TouchableOpacity>
                
                <Text style={{ fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: '#111827', flex: 1, textAlign: 'center' }}>
                  {passengers}
                </Text>

                <TouchableOpacity
                  onPress={() => setPassengers(Math.min(6, passengers + 1))}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={16} color={passengers < 6 ? "#111827" : "#D1D5DB"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Search Button */}
          <TouchableOpacity activeOpacity={0.8} onPress={handleSearch} style={{ overflow: 'hidden', borderBottomLeftRadius: 15, borderBottomRightRadius: 15 }}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.searchButton}
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        
        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <>
            <View style={styles.recentHeaderContainer}>
              <Text style={styles.recentTitle}>RECENT SEARCHES</Text>
            </View>
            
            {recentSearches.map((search, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.recentCard} 
                activeOpacity={0.7}
                onPress={() => handleRecentClick(search)}
              >
                <Feather name="clock" size={20} color="#6B7280" style={styles.recentIcon} />
                <View style={styles.recentInfo}>
                  <View style={styles.recentRoute}>
                    <Text style={[styles.recentCity, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">{search.from}</Text>
                    <Feather name="arrow-right" size={14} color="#9CA3AF" style={styles.routeArrow} />
                    <Text style={[styles.recentCity, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">{search.to}</Text>
                  </View>
                  <Text style={styles.recentDetails}>{formatDisplayDate(search.date)}, {search.passengers} passenger</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Spacer for bottom tab */}
        <View style={{ height: BottomTabInset + 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  mainTitle: {
    fontSize: 32,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  scrollContainer: {
    paddingHorizontal: 20, // Increased to match screenshot width ratio
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
    flexGrow: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
    alignSelf: 'stretch',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  logoIconBg: {
    width: 40,
    height: 40,
    backgroundColor: '#10B981',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
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
    marginHorizontal: 0, // Using full width
  },
  promoIconImg: {
    width: 32, 
    height: 22,
    marginRight: 8,
    borderRadius: 2,
  },
  promoText: {
    fontSize: 12, // Bigger and clearer text matching screenshot
    fontFamily: 'Outfit_700Bold',
    lineHeight: 18,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 20,
  },
  searchCard: {
    backgroundColor: '#FFF',
    borderRadius: 16, 
    borderWidth: 1.5, 
    borderColor: '#10B981',
    alignSelf: 'stretch',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 32, // More gap before recent searches
  },
  inputRow: {
    paddingHorizontal: 20,
    paddingVertical: 14, // Adjusted padding to match spacing perfectly
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#4B5563',
    marginBottom: 4,
  },
  textInput: {
    fontSize: 18, // Slightly smaller text matching screenshot
    color: '#111827',
    padding: 0,
    fontFamily: 'Outfit_500Medium',
  },
  passengerInputContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  passengerCount: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: '#111827',
    marginRight: 8,
  },
  passengerText: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Outfit_600SemiBold',
  },
  divider: {
    height: 0,
    borderBottomWidth: 2.5,
    borderBottomColor: '#D1D5DB', 
    borderStyle: 'dashed',
    marginHorizontal: 20,
  },
  searchButton: {
    paddingVertical: 16, 
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#10B981',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 18,
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
  recentDetails: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Outfit_500Medium',
  },
  routeArrow: {
    marginHorizontal: 8,
  },

});
