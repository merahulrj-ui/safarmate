import { showAlert } from '@/utils/alert';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { checkActiveRidesLimit } from '@/utils/rideLimits';
import LoginScreen from '@/components/LoginScreen';

export default function RideDetailsScreen() {
  const { id, source, requestedSeats } = useLocalSearchParams();
  const seatsToBook = parseInt((requestedSeats as string) || '1', 10);
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // Responsive layout (simulate side-by-side for web, stacked for mobile)
  const isLargeScreen = Dimensions.get('window').width > 768;

  useEffect(() => {
    if (id) {
      fetchRideDetails();
    }
  }, [id]);

  const fetchRideDetails = async () => {
    try {
      const docRef = doc(db, 'rides', id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setRide({ id: docSnap.id, ...docSnap.data() });
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    if (!authUser) {
      setShowLogin(true);
      return;
    }
    
    if (authUser.uid === ride.driverId) {
      showAlert("Notification", 'You cannot book your own published ride.');
      return;
    }
    
    if (ride.seatsAvailable < seatsToBook) {
      showAlert("Notification", `Sorry, only ${ride.seatsAvailable} seat${ride.seatsAvailable !== 1 ? 's' : ''} available.`);
      return;
    }

    setBookingLoading(true);
    try {
      const canProceed = await checkActiveRidesLimit(authUser.uid);
      if (!canProceed) {
        setBookingLoading(false);
        return;
      }

      // Check if user already has an active booking
      const q = query(
        collection(db, 'rides'),
        where('passengerIds', 'array-contains', authUser.uid)
      );
      const querySnapshot = await getDocs(q);
      
      // Helper to extract YYYY-MM-DD from ISO or just return YYYY-MM-DD
      const extractLocalDate = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('T') || dateStr.endsWith('Z')) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
        }
        return dateStr;
      };

      const currentLocalDate = extractLocalDate(ride.date);
      
      let hasActiveBookingSameDay = false;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const userBooking = data.bookings?.find((b: any) => b.passengerId === authUser.uid);
        if (userBooking && (userBooking.status === 'PENDING' || userBooking.status === 'ACCEPTED')) {
          if (extractLocalDate(data.date) === currentLocalDate) {
            hasActiveBookingSameDay = true;
          }
        }
      });
      
      if (hasActiveBookingSameDay) {
        showAlert("Notification", 'You already have an active booking for this date. You cannot book multiple rides on the same day.');
        setBookingLoading(false);
        return;
      }

      const docRef = doc(db, 'rides', id as string);
      const bookingData = {
        passengerId: authUser.uid,
        passengerName: authUser.displayName || 'Passenger',
        seatsBooked: seatsToBook,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };
      
      await updateDoc(docRef, {
        bookings: arrayUnion(bookingData),
        passengerIds: arrayUnion(authUser.uid),
        seatsAvailable: increment(-seatsToBook)
      });
      
      // Notify the driver
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: ride.driverId,
          title: 'New Booking Request',
          body: `${authUser.displayName || 'Someone'} requested to book ${seatsToBook} seat(s) on your ride to ${ride.to} for ₹${ride.price * seatsToBook}.`,
          type: 'REQUEST',
          rideId: id,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (e) {
      }
      
      showAlert("Notification", `Booking confirmed! ₹${ride.price * seatsToBook} paid securely via UPI.`);
      router.replace('/rides');
    } catch (e) {
      showAlert("Notification", 'Failed to book ride.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleBookingAction = async (passengerId: string, newStatus: string) => {
    const existingBooking = ride.bookings?.find((b: any) => b.passengerId === passengerId);
    if (existingBooking?.status === newStatus) return;
    
    setActionLoading(passengerId);
    try {
      const docRef = doc(db, 'rides', id as string);
      const updatedBookings = ride.bookings.map((b: any) => 
        b.passengerId === passengerId ? { ...b, status: newStatus } : b
      );
      
      let updates: any = { bookings: updatedBookings };
      let newSeats = ride.seatsAvailable;
      if (newStatus === 'REJECTED' && existingBooking?.status !== 'REJECTED' && existingBooking?.status !== 'CANCELLED') {
        const seatsToRefund = existingBooking?.seatsBooked || 1;
        updates.seatsAvailable = increment(seatsToRefund);
        newSeats += seatsToRefund;
      }
      
      setRide({ ...ride, bookings: updatedBookings, seatsAvailable: newSeats });
      
      await updateDoc(docRef, updates);
      
      // Notify the passenger
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: passengerId,
          title: newStatus === 'ACCEPTED' ? 'Booking Accepted!' : 'Booking Rejected',
          body: newStatus === 'ACCEPTED' 
            ? `Your request to join the ride to ${ride.to} has been accepted. You can now chat with the driver.`
            : `Sorry, your request to join the ride to ${ride.to} was declined by the driver.`,
          type: newStatus,
          rideId: id,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (e) {
      }
      
    } catch (e) {
      showAlert("Notification", 'Failed to update booking status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMessagePassenger = async (passengerId: string, passengerName: string) => {
    if (!authUser) return;
    setActionLoading(`msg-${passengerId}`);
    try {
      const q = query(
        collection(db, 'conversations'), 
        where('participants', 'array-contains', authUser.uid)
      );
      const querySnapshot = await getDocs(q);
      
      let conversationId = null;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.participants.includes(passengerId)) {
          conversationId = docSnap.id;
        }
      });

      if (!conversationId) {
        const newConv = {
          participants: [authUser.uid, passengerId],
          lastMessage: {
            content: 'Hello! I accepted your ride request.',
            createdAt: new Date().toISOString(),
            senderId: authUser.uid,
          },
          unreadCount: 1,
          unreadCounts: {
            [authUser.uid]: 0,
            [passengerId]: 1
          },
          users: {
            [authUser.uid]: {
              id: authUser.uid,
              name: authUser.displayName || 'Driver',
              avatar: authUser.photoURL || null
            },
            [passengerId]: {
              id: passengerId,
              name: passengerName,
              avatar: null
            }
          }
        };
        const docRef = await addDoc(collection(db, 'conversations'), newConv);
        conversationId = docRef.id;
        
        await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
          senderId: authUser.uid,
          content: 'Hello! I accepted your ride request.',
          createdAt: new Date().toISOString()
        });
      }

      router.push({
        pathname: '/chat/[id]',
        params: { 
          id: conversationId,
          name: passengerName,
          otherUserId: passengerId
        }
      });
    } catch (e) {
      showAlert("Notification", 'Failed to open chat.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMessageDriver = async () => {
    if (!authUser) {
      setShowLogin(true);
      return;
    }
    setActionLoading('msg-driver');
    try {
      const q = query(
        collection(db, 'conversations'), 
        where('participants', 'array-contains', authUser.uid)
      );
      const querySnapshot = await getDocs(q);
      
      let conversationId = null;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.participants.includes(ride.driverId)) {
          conversationId = docSnap.id;
        }
      });

      if (!conversationId) {
        const messageContent = 'Hi, I have a question about your ride.';
        const newConv = {
          participants: [authUser.uid, ride.driverId],
          lastMessage: {
            content: messageContent,
            createdAt: new Date().toISOString(),
            senderId: authUser.uid,
          },
          unreadCounts: {
            [authUser.uid]: 0,
            [ride.driverId]: 1
          },
          users: {
            [authUser.uid]: {
              id: authUser.uid,
              name: authUser.displayName || 'Passenger',
              avatar: authUser.photoURL || null
            },
            [ride.driverId]: {
              id: ride.driverId,
              name: ride.driverName || 'Driver',
              avatar: null
            }
          }
        };
        const docRef = await addDoc(collection(db, 'conversations'), newConv);
        conversationId = docRef.id;
        
        await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
          senderId: authUser.uid,
          content: messageContent,
          createdAt: new Date().toISOString()
        });
      }

      router.push({
        pathname: '/chat/[id]',
        params: { 
          id: conversationId,
          name: ride.driverName || 'Driver',
          otherUserId: ride.driverId
        }
      });
    } catch (e) {
      showAlert("Notification", 'Failed to open chat.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRide = async () => {
    try {
      setBookingLoading(true);
      const docRef = doc(db, 'rides', id as string);
      await updateDoc(docRef, {
        status: 'CANCELLED',
      });
      showAlert("Notification", 'Your published ride has been cancelled.');
      router.replace('/rides');
    } catch (e) {
      showAlert("Notification", 'Failed to cancel ride.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!authUser) return;
    
    const existingBooking = ride.bookings?.find((b: any) => b.passengerId === authUser.uid);
    if (existingBooking?.status === 'CANCELLED' || existingBooking?.status === 'REJECTED') {
      return;
    }
    
    try {
      setBookingLoading(true);
      const docRef = doc(db, 'rides', id as string);
      
      const updatedBookings = ride.bookings.map((b: any) => 
        b.passengerId === authUser.uid ? { ...b, status: 'CANCELLED' } : b
      );
      
      await updateDoc(docRef, {
        bookings: updatedBookings,
        seatsAvailable: increment(1)
      });
      
      showAlert("Notification", 'Your booking has been cancelled.');
      router.replace('/rides');
    } catch (e) {
      showAlert("Notification", 'Failed to cancel booking.');
    } finally {
      setBookingLoading(false);
    }
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

  if (loading || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (showLogin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TouchableOpacity onPress={() => setShowLogin(false)} style={{ position: 'absolute', left: 24, top: 40, zIndex: 10 }}>
          <Ionicons name="arrow-back" size={28} color="#111827" />
        </TouchableOpacity>
        <LoginScreen />
      </SafeAreaView>
    );
  }

  const departureDate = new Date(getValidDateIso(ride.date, ride.time));
  const day = String(departureDate.getDate()).padStart(2, '0');
  const month = departureDate.toLocaleString('en-US', { month: 'short' });
  const year = departureDate.getFullYear();
  const dateStr = `${day} ${month}, ${year}`;
  const timeStr = departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // A ride is considered past/completed 4 hours after departure
  const isPastRide = (departureDate.getTime() + (4 * 60 * 60 * 1000)) < new Date().getTime();
  
  // Calculate a fake arrival time (e.g., +3h30m) for the UI mock
  const arrivalDate = new Date(departureDate.getTime() + (3.5 * 60 * 60 * 1000));
  const arrivalTimeStr = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isDriver = authUser?.uid === ride.driverId;
  const passengerRequests = ride.bookings?.filter((b: any) => b.status === 'PENDING' || b.status === 'ACCEPTED') || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Back Button & Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              if (source === 'rides') {
                router.replace('/rides');
              } else {
                router.back();
              }
            }} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#0A1128" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Ride details</Text>
        </View>

        <View style={[styles.mainContent, isLargeScreen && styles.mainContentLarge]}>
          
          {/* Left Column (Ride Info) */}
          <View style={styles.leftColumn}>
            
            {/* Route Card */}
            <View style={styles.card}>
              <Text style={styles.dateTitle}>{dateStr}</Text>
              
              <View style={styles.timelineContainer}>
                
                {/* Time Column */}
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{timeStr}</Text>
                  <Text style={styles.timeText}>{arrivalTimeStr}</Text>
                </View>
                
                {/* Visual Line Column */}
                <View style={styles.lineColumn}>
                  <View style={styles.circleEmpty} />
                  <View style={styles.verticalLine} />
                  <View style={styles.circleEmpty} />
                </View>
                
                {/* Location Column */}
                <View style={styles.locationColumn}>
                  <Text style={styles.locationText}>{ride.from}</Text>
                  <View style={styles.locationSpacer}>
                    <Text style={styles.durationBadge}>3h30</Text>
                  </View>
                  <Text style={styles.locationText}>{ride.to}</Text>
                </View>

              </View>
            </View>

            {/* Passengers Visual Section (Merged) */}
            {(() => {
              const allBookings = ride.bookings?.filter((b: any) => b.status === 'PENDING' || b.status === 'ACCEPTED') || [];
              
              if (allBookings.length === 0) return null;

              return (
                <View style={styles.card}>
                  <Text style={{ fontSize: 18, fontFamily: 'Outfit_700Bold', color: '#111827', marginBottom: 16 }}>
                    {isDriver ? 'Passengers & Requests' : 'Co-passengers'}
                  </Text>
                  
                  {allBookings.map((booking: any) => {
                    return (
                      <View key={booking.passengerId} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: booking.status === 'ACCEPTED' ? '#D1FAE5' : '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                              <Text style={{ fontFamily: 'Outfit_700Bold', color: booking.status === 'ACCEPTED' ? '#059669' : '#D97706', fontSize: 16 }}>
                                {booking.passengerName ? booking.passengerName.substring(0, 1).toUpperCase() : 'P'}
                              </Text>
                            </View>
                            <View>
                              <Text style={{ fontSize: 16, fontFamily: 'Outfit_600SemiBold', color: '#111827' }}>
                                {booking.passengerName}
                              </Text>
                              <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: booking.status === 'ACCEPTED' ? '#10B981' : '#D97706' }}>
                                {booking.status === 'ACCEPTED' ? 'Booked' : 'Requested'} • {booking.seatsBooked || 1} seat{(booking.seatsBooked || 1) !== 1 ? 's' : ''} (₹{ride.price * (booking.seatsBooked || 1)})
                              </Text>
                            </View>
                          </View>
                          
                          {/* Driver Actions */}
                          {isDriver && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              {booking.status === 'PENDING' ? (
                                <>
                                  <TouchableOpacity 
                                    style={[styles.actionButton, styles.acceptButton, { paddingHorizontal: 12, paddingVertical: 6, minWidth: 60 }]}
                                    onPress={() => handleBookingAction(booking.passengerId, 'ACCEPTED')}
                                    disabled={actionLoading === booking.passengerId}
                                  >
                                    {actionLoading === booking.passengerId ? (
                                      <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                      <Text style={[styles.acceptButtonText, { fontSize: 12 }]}>Accept</Text>
                                    )}
                                  </TouchableOpacity>
                                  
                                  <TouchableOpacity 
                                    style={[styles.actionButton, styles.rejectButton, { paddingHorizontal: 12, paddingVertical: 6, minWidth: 60 }]}
                                    onPress={() => handleBookingAction(booking.passengerId, 'REJECTED')}
                                    disabled={actionLoading === booking.passengerId}
                                  >
                                    <Text style={[styles.rejectButtonText, { fontSize: 12 }]}>Reject</Text>
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <TouchableOpacity 
                                  style={styles.messageButton}
                                  onPress={() => handleMessagePassenger(booking.passengerId, booking.passengerName)}
                                  disabled={actionLoading === `msg-${booking.passengerId}`}
                                >
                                  {actionLoading === `msg-${booking.passengerId}` ? (
                                    <ActivityIndicator size="small" color="#10B981" />
                                  ) : (
                                    <Ionicons name="chatbubble-outline" size={20} color="#10B981" />
                                  )}
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Driver Card */}
            {!isDriver && (
              <View style={styles.card}>
                <View style={styles.driverHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {ride.driverName ? ride.driverName.substring(0, 2).toUpperCase() : 'TU'}
                    </Text>
                  </View>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{ride.driverName || 'Test User'}</Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={14} color="#10B981" />
                      <Text style={styles.ratingText}>3.67/5 - 15 ratings</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.featureRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="checkmark" size={16} color="#10B981" />
                  </View>
                  <Text style={styles.featureText}>Rarely cancels rides</Text>
                </View>

                <View style={styles.featureRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                    <Ionicons name="flash" size={16} color="#F97316" />
                  </View>
                  <Text style={styles.featureText}>Driver needs to accept your request</Text>
                </View>

                <View style={styles.featureRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#F3F4F6' }]}>
                    <Ionicons name="car" size={16} color="#6B7280" />
                  </View>
                  <Text style={styles.featureText}>{ride.carModel || 'Swift'}</Text>
                </View>
                {ride.bookings?.find((b: any) => b.passengerId === authUser?.uid)?.status === 'ACCEPTED' && (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.messageDriverButton]} 
                    onPress={handleMessageDriver}
                    disabled={actionLoading === 'msg-driver'}
                  >
                    {actionLoading === 'msg-driver' ? (
                      <ActivityIndicator size="small" color="#059669" />
                    ) : (
                      <>
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color="#059669" style={{ marginRight: 8 }} />
                        <Text style={styles.messageDriverButtonText}>Message Driver</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}


            {/* Eco Footprint Card */}
            <View style={styles.card}>
              <View style={styles.ecoRow}>
                <Ionicons name="leaf" size={24} color="#10B981" style={{ marginRight: 12, marginTop: 4 }} />
                <Text style={styles.ecoText}>
                  By choosing this trip, you will help avoid -26.4 kg of CO2. A total of 10.8 kg CO2 emissions are associated with this booking (71% less than travelling alone by car).{' '}
                  <TouchableOpacity onPress={() => showAlert('Coming Soon', 'Our environmental impact report will be available soon!')}>
                    <Text style={styles.ecoLink}>See our impact report</Text>
                  </TouchableOpacity>
                  {' '}for methodology.
                </Text>
              </View>
            </View>

          </View>

          {/* Right Column (Booking Card) */}
          <View style={styles.rightColumn}>
            <View style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View>
                  <Text style={styles.passengerCountText}>{seatsToBook} passenger{seatsToBook !== 1 ? 's' : ''}</Text>
                  <Text style={styles.seatsLeftText}>{Math.max(0, ride.seatsAvailable || 0)} seat{Math.max(0, ride.seatsAvailable || 0) !== 1 ? 's' : ''} left</Text>
                </View>
                <Text style={styles.priceText}>₹{(Number(ride.price) * seatsToBook).toFixed(2)}</Text>
              </View>
              
              <View style={styles.bookingDivider} />
              
              {ride.status === 'CANCELLED' ? (
                <View style={[styles.cancelRideButton, { backgroundColor: '#FEE2E2', borderColor: '#FEE2E2' }]}>
                  <Text style={[styles.cancelRideButtonText, { color: '#EF4444' }]}>{isDriver ? 'Ride Cancelled' : 'Ride Cancelled by Driver'}</Text>
                </View>
              ) : !isDriver && ride.bookings?.find((b: any) => b.passengerId === authUser?.uid)?.status === 'CANCELLED' ? (
                <View style={[styles.cancelRideButton, { backgroundColor: '#FEE2E2', borderColor: '#FEE2E2' }]}>
                  <Text style={[styles.cancelRideButtonText, { color: '#EF4444' }]}>Booking Cancelled</Text>
                </View>
              ) : isPastRide ? (
                <View style={[styles.cancelRideButton, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                  <Text style={[styles.cancelRideButtonText, { color: '#6B7280' }]}>Ride Completed</Text>
                </View>
              ) : isDriver ? (
                <TouchableOpacity 
                  style={styles.cancelRideButton} 
                  activeOpacity={0.8} 
                  onPress={handleCancelRide}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? (
                    <ActivityIndicator color="#EF4444" />
                  ) : (
                    <Text style={styles.cancelRideButtonText}>Cancel Published Ride</Text>
                  )}
                </TouchableOpacity>
              ) : ride.bookings?.some((b: any) => b.passengerId === authUser?.uid) ? (
                <TouchableOpacity 
                  style={styles.cancelRideButton} 
                  activeOpacity={0.8} 
                  onPress={handleCancelBooking}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? (
                    <ActivityIndicator color="#EF4444" />
                  ) : (
                    <Text style={styles.cancelRideButtonText}>Cancel My Booking</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.bookButton} 
                  activeOpacity={0.8} 
                  onPress={handleBook}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.bookButtonText}>Request to Book</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    padding: 24,
    paddingBottom: 100,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: '#0A1128',
  },
  mainContent: {
    flexDirection: 'column',
    gap: 24,
  },
  mainContentLarge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftColumn: {
    flex: 1,
    gap: 24,
  },
  rightColumn: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dateTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#0A1128',
    marginBottom: 24,
  },
  timelineContainer: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 60,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  lineColumn: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  circleEmpty: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4B5563',
    backgroundColor: '#FFF',
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#0A1128',
    marginVertical: 4,
  },
  locationColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  locationText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  locationSpacer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  durationBadge: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Outfit_600SemiBold',
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6B21A8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Outfit_500Medium',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#4B5563',
    fontFamily: 'Outfit_500Medium',
  },
  ecoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ecoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
    fontFamily: 'Outfit_500Medium',
  },
  ecoLink: {
    color: '#10B981',
    fontFamily: 'Outfit_700Bold',
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  passengerCountText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 4,
  },
  seatsLeftText: {
    fontSize: 13,
    color: '#10B981',
    fontFamily: 'Outfit_600SemiBold',
  },
  priceText: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  bookingDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 24,
  },
  bookButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  cancelRideButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  cancelRideButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  requestsTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 20,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  requestPassengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestAvatarText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#4B5563',
  },
  requestPassengerName: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  messageDriverButton: {
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageDriverButtonText: {
    color: '#059669',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  rejectButton: {
    backgroundColor: '#FEE2E2',
  },
  rejectButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  acceptedBadgeText: {
    color: '#10B981',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  messageButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
