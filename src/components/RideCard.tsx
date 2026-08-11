import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Ride {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  price: number;
  seatsAvailable: number;
  status?: string;
  bookingStatus?: string;
  bookings?: any[];
  driver?: {
    name: string;
    avatar: string | null;
  };
}

interface RideCardProps {
  ride: Ride;
  type: 'booked' | 'published' | 'search';
  onPress?: () => void;
}

export default function RideCard({ ride, type, onPress }: RideCardProps) {
  const departureDate = ride?.departureDate && !isNaN(new Date(ride.departureDate).getTime()) ? new Date(ride.departureDate) : null;
  const day = departureDate ? String(departureDate.getDate()).padStart(2, '0') : '';
  const month = departureDate ? departureDate.toLocaleString('en-US', { month: 'short' }) : '';
  const year = departureDate ? departureDate.getFullYear() : '';
  const dateStr = departureDate ? `${day} ${month}, ${year}` : 'Date TBD';
  const timeStr = departureDate ? departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const getStatusColor = (status: string) => {
    if (status === 'ACCEPTED') return { bg: '#D1FAE5', text: '#10B981', icon: 'checkmark-circle' };
    if (status === 'REJECTED' || status === 'CANCELLED') return { bg: '#FEE2E2', text: '#EF4444', icon: 'close-circle' };
    return { bg: '#FEF3C7', text: '#D97706', icon: 'time' }; // PENDING
  };

  const pendingBookings = ride.bookings?.filter(b => b.status === 'PENDING').length || 0;
  const isDriver = type === 'published';

  return (
    <TouchableOpacity style={styles.cardContainer} activeOpacity={0.8} onPress={onPress}>
      <LinearGradient 
        colors={isDriver ? ['#10B981', '#059669'] : ['#6366F1', '#4F46E5']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={styles.cardHeader}
      >
        <View style={styles.headerTop}>
          <View style={styles.roleTag}>
            <Ionicons name={isDriver ? "car-sport" : "person"} size={14} color="#FFF" />
            <Text style={styles.roleText}>{isDriver ? 'Driving' : 'Riding'}</Text>
          </View>
          <Text style={styles.priceText}>₹{ride.price}</Text>
        </View>
        <Text style={styles.dateText}>{timeStr ? `${dateStr} • ${timeStr}` : dateStr}</Text>
      </LinearGradient>

      <View style={styles.cardBody}>
        <View style={styles.routeContainer}>
          <View style={styles.timeline}>
            <View style={styles.dotFilled} />
            <View style={styles.line} />
            <View style={styles.dotEmpty} />
          </View>
          <View style={styles.locations}>
            <Text style={styles.locationText} numberOfLines={1}>{ride.origin}</Text>
            <Text style={styles.locationText} numberOfLines={1}>{ride.destination}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.driverSection}>
            {ride.driver?.avatar && !ride.driver.avatar.includes('pravatar') ? (
              <Image source={{ uri: ride.driver.avatar }} style={styles.driverAvatar} />
            ) : (
              <View style={[styles.driverAvatar, { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontFamily: 'Outfit_700Bold', color: '#6B7280', fontSize: 14 }}>
                  {ride.driver?.name ? ride.driver.name.substring(0, 1).toUpperCase() : 'U'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.driverName}>{ride.driver?.name || 'You'}</Text>
              <Text style={styles.driverSubtitle}>{Math.max(0, ride.seatsAvailable || 0)} seat{Math.max(0, ride.seatsAvailable || 0) !== 1 ? 's' : ''} left</Text>
            </View>
          </View>

          <View style={styles.statusSection}>
            {type === 'booked' && ride.bookingStatus && (
              <View style={[styles.statusPill, { backgroundColor: getStatusColor(ride.bookingStatus).bg }]}>
                <Ionicons name={getStatusColor(ride.bookingStatus).icon as any} size={14} color={getStatusColor(ride.bookingStatus).text} />
                <Text style={[styles.statusText, { color: getStatusColor(ride.bookingStatus).text }]}>
                  {ride.bookingStatus}
                </Text>
              </View>
            )}
            
            {type === 'published' && ride.status === 'CANCELLED' && (
              <View style={[styles.statusPill, { backgroundColor: getStatusColor('CANCELLED').bg }]}>
                <Ionicons name={getStatusColor('CANCELLED').icon as any} size={14} color={getStatusColor('CANCELLED').text} />
                <Text style={[styles.statusText, { color: getStatusColor('CANCELLED').text }]}>
                  CANCELLED
                </Text>
              </View>
            )}

            {type === 'published' && pendingBookings > 0 && (
              <View style={styles.newRequestsBadge}>
                <Text style={styles.newRequestsText}>{pendingBookings} Request{pendingBookings > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  roleText: {
    color: '#FFF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceText: {
    color: '#FFF',
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
  },
  dateText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  cardBody: {
    padding: 16,
    paddingTop: 24,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -12,
  },
  routeContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  timeline: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dotFilled: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 3,
    borderColor: '#10B981',
  },
  line: {
    width: 2,
    height: 28,
    backgroundColor: '#F3F4F6',
    marginVertical: 2,
  },
  dotEmpty: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 3,
    borderColor: '#E5E7EB',
  },
  locations: {
    justifyContent: 'space-between',
    paddingVertical: 1,
    flex: 1,
  },
  locationText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  driverName: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  driverSubtitle: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: '#6B7280',
    marginTop: 2,
  },
  statusSection: {
    alignItems: 'flex-end',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newRequestsBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  newRequestsText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
