import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface SearchRideCardProps {
  ride: any;
  passengers?: number;
}

export default function SearchRideCard({ ride, passengers = 1 }: SearchRideCardProps) {
  const router = useRouter();
  const departureDate = new Date(ride.departureDate);
  const timeStr = departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Fake arrival time (+ 1 hour for now)
  const arrivalDate = new Date(departureDate.getTime() + 60 * 60 * 1000);
  const arrivalTimeStr = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isFull = ride.seatsAvailable < passengers;

  return (
    <TouchableOpacity 
      style={[styles.card, isFull && styles.cardFull]} 
      activeOpacity={0.7} 
      onPress={() => !isFull && router.push(`/ride/${ride.id}`)}
      disabled={isFull}
    >
      <View style={styles.topSection}>
        
        {/* Timeline & Locations */}
        <View style={styles.leftContent}>
          {/* Times & Timeline Line */}
          <View style={styles.timeColumn}>
            <Text style={styles.timeText}>{timeStr}</Text>
            <Text style={styles.durationText}>1h00</Text>
            
            <View style={styles.timelineLineContainer}>
              <View style={styles.dot} />
              <View style={styles.line} />
              <View style={styles.dot} />
            </View>

            <Text style={[styles.timeText, { marginTop: 4 }]}>{arrivalTimeStr}</Text>
          </View>

          {/* Locations */}
          <View style={styles.locationColumn}>
            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">{ride.origin}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">{ride.destination}</Text>
          </View>
        </View>

        {/* Price & Seats */}
        <View style={styles.rightContent}>
          {isFull ? (
            <Text style={styles.fullText}>Full</Text>
          ) : (
            <>
              <Text style={styles.priceText}>₹ {ride.price}</Text>
              <Text style={styles.seatsText}>{ride.seatsAvailable} seat{ride.seatsAvailable !== 1 ? 's' : ''} left</Text>
            </>
          )}

          {ride.womenOnly && (
            <View style={styles.womenOnlyBadge}>
              <Text style={styles.womenOnlyText}>WOMEN ONLY</Text>
            </View>
          )}
        </View>

      </View>

      <View style={styles.divider} />

      <View style={styles.driverSection}>
        <View style={styles.driverInfo}>
          <Image source={{ uri: ride.driver?.avatar || 'https://i.pravatar.cc/150' }} style={styles.avatar} />
          <View>
            <Text style={styles.driverName}>{ride.driver?.name || 'Driver'}</Text>
            <View style={styles.ratingRow}>
              <Feather name="star" size={12} color="#054752" />
              <Text style={styles.ratingText}>{ride.rating || '4.9'}</Text>
            </View>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardFull: {
    opacity: 0.6,
  },
  topSection: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftContent: {
    flexDirection: 'row',
    gap: 16,
    flex: 1,
  },
  timeColumn: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#054752',
    lineHeight: 18,
  },
  durationText: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: '#64748B',
    marginBottom: 4,
  },
  timelineLineContainer: {
    alignItems: 'center',
    marginVertical: 4,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#054752',
    backgroundColor: '#FFF',
    zIndex: 10,
  },
  line: {
    width: 2,
    height: 36, // Adjust based on spacing
    backgroundColor: '#054752',
    marginVertical: -1,
  },
  locationColumn: {
    justifyContent: 'space-between',
    paddingVertical: 1,
    flex: 1,
    marginRight: 12,
  },
  locationText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#054752',
  },
  rightContent: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  priceText: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#054752',
  },
  seatsText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: '#10B981',
    marginTop: 4,
  },
  fullText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#054752',
  },
  womenOnlyBadge: {
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 8,
  },
  womenOnlyText: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    color: '#EC4899',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#00A78E',
  },
  driverName: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#334155',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: '#64748B',
  },
});
