import { showAlert } from '@/utils/alert';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { BottomTabInset } from '@/constants/theme';
import RideCard from '@/components/RideCard';
import { RideCardSkeleton } from '@/components/SkeletonLoader';
import LoginScreen from '@/components/LoginScreen';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function SearchResultsScreen() {
  const { user: authUser, loading } = useAuth();
  const isLoggedIn = !!authUser;
  const router = useRouter();

  const { from, to, date, fromLat, fromLon, toLat, toLon, passengers } = useLocalSearchParams();
  const passengersCount = parseInt((passengers as string) || '1', 10);

  const [publishedRides, setPublishedRides] = useState<any[]>([]);
  const [bookedRides, setBookedRides] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);

  const getDistanceFromLatLonInKm = (lat1: any, lon1: any, lat2: any, lon2: any) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
    const R = 6371; // Radius of the earth in km
    const dLat = (Number(lat2) - Number(lat1)) * (Math.PI / 180);
    const dLon = (Number(lon2) - Number(lon1)) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(Number(lat1) * (Math.PI / 180)) * Math.cos(Number(lat2) * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c;
  };

  const getValidDateIso = (dateStr?: string, timeStr?: string) => {
    if (!dateStr || !timeStr) return new Date().toISOString();
    try {
      let year, month, day;
      if (dateStr.includes('T') || dateStr.endsWith('Z')) {
        const tempD = new Date(dateStr);
        year = tempD.getFullYear();
        month = tempD.getMonth() + 1;
        day = tempD.getDate();
      } else {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return new Date().toISOString();
        year = Number(parts[0]);
        month = Number(parts[1]);
        day = Number(parts[2]);
      }
      
      let [hours, minutes] = timeStr.replace(/[^0-9:]/g, '').split(':').map(Number);
      if (timeStr.toLowerCase().includes('pm') && hours < 12) hours += 12;
      if (timeStr.toLowerCase().includes('am') && hours === 12) hours = 0;
      
      const d = new Date(year, month - 1, day, hours, minutes);
      if (isNaN(d.getTime())) return new Date().toISOString();
      return d.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  };

  useEffect(() => {
    setLoadingRides(true);
    let unsubscribe: () => void;

    const q = query(collection(db, 'rides'));
    unsubscribe = onSnapshot(q, (querySnapshot) => {
      const searchResults: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        let matchesFrom = true;
        let matchesTo = true;

        if (fromLat && fromLon && data.fromLat && data.fromLon) {
          matchesFrom = getDistanceFromLatLonInKm(fromLat, fromLon, data.fromLat, data.fromLon) <= 50;
        } else if (from) {
          matchesFrom = data.from?.toLowerCase().includes((from as string).toLowerCase());
        }

        if (toLat && toLon && data.toLat && data.toLon) {
          matchesTo = getDistanceFromLatLonInKm(toLat, toLon, data.toLat, data.toLon) <= 50;
        } else if (to) {
          matchesTo = data.to?.toLowerCase().includes((to as string).toLowerCase());
        }

        if (data.status === 'CANCELLED') return;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const departureIso = getValidDateIso(data.date, data.time);

        if (departureIso < todayStart) return;
        
        if (date && typeof date === 'string') {
          const departureDateStr = departureIso.split('T')[0];
          if (departureDateStr !== date) return;
        }

        if (matchesFrom && matchesTo) {
          const available = data.seatsAvailable !== undefined ? data.seatsAvailable : 3;
          if (available < passengersCount) return;

          searchResults.push({
            id: doc.id,
            origin: data.from,
            destination: data.to,
            departureDate: departureIso,
            price: Number(data.price),
            seatsAvailable: available,
            bookings: data.bookings || [],
            driver: { name: data.driverName || 'Driver', avatar: null }
          });
        }
      });
      setPublishedRides(searchResults);
      setLoadingRides(false);
    }, (e) => {
      setLoadingRides(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [from, to, fromLat, fromLon, toLat, toLon]);

  const hasRides = publishedRides.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={{ alignItems: 'center' }}>
          {/* Header Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoIconBg}>
              <FontAwesome5 name="map-marker-alt" size={20} color="#FFF" />
            </View>
            <Text style={styles.logoText}>
              <Text style={{ color: '#0A1128' }}>Safar</Text>
              <Text style={{ color: '#10B981' }}>Mate</Text>
            </Text>
          </View>

          {/* Promo Banner */}
          <View style={styles.promoBanner}>
            <Image source={{ uri: 'https://flagcdn.com/w40/in.png' }} style={styles.promoIconImg} />
            <Text style={styles.promoText} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={{ color: '#FF9933' }}>PURELY MADE </Text>
              <Text style={{ color: '#FFFFFF' }}>IN INDIA, MADE FOR </Text>
              <Text style={{ color: '#10B981' }}>INDIA</Text>
            </Text>
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitle}>100% ADVERTISEMENT FREE</Text>
          
          {/* Search Summary Capsule */}
          <View style={styles.summaryCapsule}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
            
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryRoute}>{from} <Ionicons name="arrow-forward" size={14} color="#9CA3AF" style={{ top: 2 }} /> {to}</Text>
              <Text style={styles.summaryDetails}>{date}, {passengersCount} passenger{passengersCount !== 1 ? 's' : ''}</Text>
            </View>
            
            <TouchableOpacity style={styles.filterButton} onPress={() => showAlert('Coming Soon', 'Advanced filters will be available in the next update!')}>
              <Text style={styles.filterText}>Filter</Text>
            </TouchableOpacity>
          </View>

        <View style={{ width: '100%' }}>
          <Text style={styles.dateHeading}>{date}</Text>
        </View>
        </View>

        {loadingRides ? (
          <View style={styles.contentContainer}>
            <View style={styles.section}>
              <RideCardSkeleton />
              <RideCardSkeleton />
              <RideCardSkeleton />
            </View>
          </View>
        ) : !hasRides ? (
          <View style={[styles.emptyStateContainer, { paddingTop: 60 }]}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="car-sport-outline" size={80} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>No rides found</Text>
            <Text style={styles.emptySubtitle}>
              We couldn't find any rides matching your criteria. Try adjusting your search!
            </Text>
          </View>
        ) : (
          <View style={styles.contentContainer}>
            <View style={styles.section}>
              {publishedRides.map(ride => (
                <RideCard 
                  key={`search-${ride.id}`} 
                  ride={ride as any} 
                  type="search" 
                  onPress={() => router.push({ pathname: '/ride/[id]', params: { id: ride.id, requestedSeats: passengersCount }})} 
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: BottomTabInset + 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    flexGrow: 1,
  },
  pageTitle: {
    fontSize: 32,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 32,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIconWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F0F5FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 32,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Outfit_500Medium',
    maxWidth: '90%',
    lineHeight: 24,
  },
  searchEmptySubtitle: {
    fontSize: 18,
    color: '#9CA3AF',
    fontFamily: 'Outfit_600SemiBold',
    lineHeight: 28,
    maxWidth: '100%',
  },
  contentContainer: {
    gap: 32,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderRadius: 50,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
    alignSelf: 'stretch',
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
    backgroundColor: '#0A1128',
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
  subtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 20,
    textAlign: 'center',
  },
  summaryCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
    width: '100%',
  },
  backButton: {
    paddingRight: 12,
  },
  summaryInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  summaryRoute: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 2,
  },
  summaryDetails: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Outfit_500Medium',
  },
  filterButton: {
    paddingLeft: 12,
  },
  filterText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#10B981',
  },
  dateHeading: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: '#034E59',
    marginBottom: 24,
  },
});
