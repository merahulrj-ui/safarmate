import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, Feather } from '@expo/vector-icons';
import { BottomTabInset } from '@/constants/theme';
import RideCard from '@/components/RideCard';
import { RideCardSkeleton } from '@/components/SkeletonLoader';
import LoginScreen from '@/components/LoginScreen';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const HistoryRideCard = ({ ride, type, onPress }: { ride: any, type: string, onPress: () => void }) => {
  const isDriver = type === 'published';
  const statusColor = ride.status === 'CANCELLED' ? '#EF4444' : '#10B981';
  
  const d = new Date(ride.departureDate);
  const dateStr = !isNaN(d.getTime()) 
    ? `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })}, ${d.getFullYear()}`
    : 'Unknown Date';

  return (
    <TouchableOpacity 
      style={[styles.historyCard, { borderLeftColor: isDriver ? '#10B981' : '#6366F1', borderLeftWidth: 4 }]} 
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.historyInfo}>
        <View style={styles.historyHeader}>
          <View style={[styles.historyRoleTag, { backgroundColor: isDriver ? '#ECFDF5' : '#EEF2FF' }]}>
            <Ionicons name={isDriver ? "car-sport" : "person"} size={14} color={isDriver ? "#10B981" : "#6366F1"} />
            <Text style={[styles.historyRoleText, { color: isDriver ? '#047857' : '#4338CA' }]}>
              {isDriver ? 'Driving' : 'Riding'}
            </Text>
          </View>
          <Text style={styles.historyDetails}>{dateStr}</Text>
        </View>
        
        <View style={styles.historyRoute}>
          <Text style={styles.historyCity}>{ride.origin || 'Origin'}</Text>
          <Feather name="arrow-right" size={16} color="#9CA3AF" style={styles.historyArrow} />
          <Text style={styles.historyCity}>{ride.destination || 'Dest'}</Text>
        </View>
      </View>
      <View style={styles.historyEnd}>
        {ride.status === 'CANCELLED' ? (
          <Text style={[styles.historyPrice, { color: '#EF4444', fontSize: 13 }]}>Cancelled</Text>
        ) : (
          <Text style={styles.historyPrice}>₹{ride.price}</Text>
        )}
        <Feather name="chevron-right" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
};

export default function RidesScreen() {
  const { user: authUser, loading } = useAuth();
  const isLoggedIn = !!authUser;
  const router = useRouter();

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
    if (!authUser) return;

    setLoadingRides(true);
    
    const q = query(collection(db, 'rides'), where('driverId', '==', authUser.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const rides: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        rides.push({
          id: doc.id,
          origin: data.from,
          destination: data.to,
          departureDate: getValidDateIso(data.date, data.time),
          price: Number(data.price),
          seatsAvailable: data.seatsAvailable !== undefined ? data.seatsAvailable : 3,
          status: data.status,
          bookings: data.bookings || [],
          driver: { name: 'You', avatar: null }
        });
      });
      setPublishedRides(rides);
      setLoadingRides(false);
    }, (e) => {
      setLoadingRides(false);
    });

    const qBooked = query(collection(db, 'rides'), where('passengerIds', 'array-contains', authUser.uid));
    const unsubscribeBooked = onSnapshot(qBooked, (querySnapshot) => {
      const rides: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const userBooking = data.bookings?.find((b: any) => b.passengerId === authUser.uid);
        rides.push({
          id: doc.id,
          origin: data.from,
          destination: data.to,
          departureDate: getValidDateIso(data.date, data.time),
          price: Number(data.price),
          seatsAvailable: data.seatsAvailable !== undefined ? data.seatsAvailable : 3,
          bookingStatus: userBooking ? userBooking.status : 'PENDING',
          driver: { name: data.driverName || 'Driver', avatar: null }
        });
      });
      setBookedRides(rides);
    }, (e) => {
    });

    return () => {
      unsubscribe();
      unsubscribeBooked();
    };
  }, [authUser]);

  const now = new Date();

  const allRides = [...bookedRides.map(r => ({...r, role: 'passenger'})), ...publishedRides.map(r => ({...r, role: 'driver'}))]
    .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());

  // A ride remains active until 4 hours after its departure time (during the journey)
  const activeRides = allRides.filter(r => {
    const rideEndTime = new Date(r.departureDate).getTime() + (4 * 60 * 60 * 1000);
    return rideEndTime >= now.getTime();
  });
  
  const historyRides = allRides.filter(r => {
    const rideEndTime = new Date(r.departureDate).getTime() + (4 * 60 * 60 * 1000);
    return rideEndTime < now.getTime();
  }).reverse().slice(0, 6); // Show only the 6 most recent history rides

  const hasRides = allRides.length > 0;

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.pageTitle}>Your Rides</Text>

        {loadingRides ? (
          <View style={styles.contentContainer}>
            <RideCardSkeleton />
            <RideCardSkeleton />
            <RideCardSkeleton />
          </View>
        ) : !hasRides ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="search-outline" size={80} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>Your future travel plans will{'\n'}appear here.</Text>
            <Text style={styles.emptySubtitle}>
              Find the perfect ride from thousands of destinations, or publish to share your travel costs.
            </Text>
          </View>
        ) : (
          <View style={styles.contentContainer}>
            {activeRides.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Rides</Text>
                {activeRides.map(ride => (
                  <RideCard 
                    key={`${ride.role}-${ride.id}`} 
                    ride={ride as any} 
                    type={ride.role === 'driver' ? 'published' : 'booked'} 
                    onPress={() => router.push({ pathname: '/ride/[id]', params: { id: ride.id, source: 'rides' } })}
                  />
                ))}
              </View>
            )}

            {historyRides.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>History</Text>
                {historyRides.map(ride => (
                  <HistoryRideCard 
                    key={`${ride.role}-${ride.id}`} 
                    ride={ride as any} 
                    type={ride.role === 'driver' ? 'published' : 'booked'} 
                    onPress={() => router.push({ pathname: '/ride/[id]', params: { id: ride.id, source: 'rides' } })}
                  />
                ))}
              </View>
            )}
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
    backgroundColor: '#ECFDF5',
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
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  historyInfo: {
    flex: 1,
    paddingLeft: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  historyRoleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  historyRoleText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyCity: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  historyArrow: {
    marginHorizontal: 8,
  },
  historyDetails: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Outfit_500Medium',
  },
  historyEnd: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  historyPrice: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  }
});
