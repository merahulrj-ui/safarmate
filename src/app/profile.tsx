import { showAlert } from '@/utils/alert';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { signOut, deleteUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';

import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';
import { BottomTabInset } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const router = useRouter();
  const { user: authUser, loading } = useAuth();
  const isLoggedIn = !!authUser;

  const [userData, setUserData] = useState<any>(null);
  const [ratingInfo, setRatingInfo] = useState({ avg: 0, count: 0 });

  useFocusEffect(
    useCallback(() => {
      if (authUser) {
        const fetchUserData = async () => {
          try {
            const userDoc = await getDoc(doc(db, 'users', authUser.uid));
            if (userDoc.exists()) {
              setUserData(userDoc.data());
            }

            // Fetch ratings
            const q = query(collection(db, 'ratings'), where('toUserId', '==', authUser.uid));
            const snap = await getDocs(q);
            if (!snap.empty) {
              let total = 0;
              snap.forEach(d => {
                const data = d.data();
                total += data.rating;
              });
              const avg = total / snap.size;
              setRatingInfo({ avg, count: snap.size });
            }
          } catch (e) {
          }
        };
        fetchUserData();
      }
    }, [authUser])
  );

  const executeDelete = async () => {
    if (!authUser) return;
    try {
      await deleteDoc(doc(db, 'users', authUser.uid));
      await deleteUser(authUser);
      await AsyncStorage.clear();
      await signOut(auth);
      
      if (Platform.OS !== 'web') {
        Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
      } else {
        window.alert('Your account has been permanently deleted.');
      }
      router.replace('/');
    } catch (e: any) {
      if (e.code === 'auth/requires-recent-login') {
        const msg = 'Please log out and log in again to delete your account. This is a security requirement.';
        if (Platform.OS !== 'web') Alert.alert('Security Requirement', msg);
        else window.alert(msg);
      } else {
        const err = 'Failed to delete account. Please try again.';
        if (Platform.OS !== 'web') Alert.alert('Error', err);
        else window.alert(err);
      }
    }
  };

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.');
      if (confirm) {
        executeDelete();
      }
    } else {
      Alert.alert(
        'Delete Account', 
        'Are you sure you want to permanently delete your account? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: executeDelete }
        ]
      );
    }
  };

  const handleCloseAccount = () => {
    showAlert('Close Account', 'Your account will be deactivated. You can reactivate it by logging in again within 30 days.');
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // Same fallback for login as before
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 20, marginBottom: 20 }}>You are not logged in.</Text>
        <TouchableOpacity style={{ overflow: 'hidden', borderRadius: 24 }} onPress={() => router.push('/')}>
          <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 12, paddingHorizontal: 24 }}>
            <Text style={styles.primaryButtonText}>Go Home</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Calculate profile data
  const finalName = userData?.name 
    || (userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : null)
    || authUser?.displayName 
    || '';
    
  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const user = {
    name: finalName,
    avatar: userData?.avatar || authUser?.photoURL || null,
    govtIdStatus: userData?.govtIdStatus || (userData?.govtIdVerified ? 'verified' : 'unverified'),
    email: authUser?.email || userData?.email || '',
    phone: authUser?.phoneNumber || userData?.phone || null,
    dob: userData?.dob || null,
    gender: userData?.gender || null,
    bio: userData?.bio || null,
    travelPreferences: userData?.travelPreferences || null,
  };

  const hasVehicles = userData?.vehicles && userData.vehicles.length > 0;
  const isProfileDetailsComplete = !!(user.avatar && !String(user.avatar).includes('ui-avatars') && user.name && user.dob && user.gender && user.bio);
  
  const getReliability = () => {
    const total = userData?.stats?.totalRides || 0;
    const cancelled = userData?.stats?.cancelledRides || 0;
    
    // No rides ever
    if (total === 0) {
      return { text: 'New to SafarMile: No rides yet', color: '#4B5563', bgColor: '#F3F4F6', borderColor: '#E5E7EB', icon: 'info' };
    }
    
    // Perfect record
    if (cancelled === 0) {
      return { text: 'Reliability: Never cancels rides', color: '#065F46', bgColor: '#ECFDF5', borderColor: '#D1FAE5', icon: 'shield' };
    }
    
    const cancelRate = cancelled / total;
    if (cancelRate <= 0.15) {
      return { text: 'Reliability: Rarely cancels rides', color: '#1E40AF', bgColor: '#DBEAFE', borderColor: '#BFDBFE', icon: 'award' };
    } else if (cancelRate <= 0.3) {
      return { text: 'Reliability: Sometimes cancels rides', color: '#92400E', bgColor: '#FEF3C7', borderColor: '#FDE68A', icon: 'alert-circle' };
    } else {
      return { text: 'Reliability: Often cancels rides', color: '#991B1B', bgColor: '#FEE2E2', borderColor: '#FECACA', icon: 'alert-triangle' };
    }
  };

  const reliability = getReliability();
  
  let completed = 0;
  if (user.name) completed++;
  if (user.dob) completed++;
  if (user.gender) completed++;
  if (user.bio) completed++;
  if (user.avatar && !String(user.avatar).includes('ui-avatars')) completed++;
  
  const total = 5;

  const renderMenuItem = (icon: any, text: string, subtitle?: string, onPress?: () => void) => (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <View style={styles.menuIconBox}>
          <Feather name={icon} size={20} color="#10B981" />
        </View>
        <View>
          <Text style={styles.menuItemText}>{text}</Text>
          {subtitle && <Text style={styles.menuItemSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Feather name="chevron-right" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderTrustBadge = (icon: any, title: string, status: 'verified' | 'pending' | 'unverified', onPress: () => void) => {
    let iconColor = '#9CA3AF';
    let bgColor = '#F3F4F6';
    let displayIcon = icon;

    if (status === 'verified') {
      iconColor = '#10B981';
      bgColor = '#ECFDF5';
    } else if (status === 'pending') {
      iconColor = '#F59E0B'; // Amber/Yellow
      bgColor = '#FEF3C7';
      displayIcon = 'clock';
    }

    return (
      <TouchableOpacity 
        style={[styles.trustBadge, { backgroundColor: bgColor, borderColor: status === 'unverified' ? '#E5E7EB' : bgColor }]}
        activeOpacity={0.7} 
        onPress={onPress}
      >
        <View style={[styles.badgeIconWrapper, { backgroundColor: status === 'unverified' ? '#F9FAFB' : bgColor }]}>
          <Feather name={displayIcon} size={24} color={iconColor} />
          {status === 'verified' && (
            <View style={styles.badgeCheck}>
              <Feather name="check" size={12} color="#FFF" />
            </View>
          )}
        </View>
        <Text style={[styles.badgeText, { color: status === 'unverified' ? '#6B7280' : iconColor }]}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const getMemberSince = () => {
    if (!userData?.createdAt) return 'New Member';
    try {
      const date = new Date(userData.createdAt);
      return `Joined ${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    } catch {
      return 'New Member';
    }
  };
  const memberSince = getMemberSince();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
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

        {/* CARD 1: Identity & Social Stats */}
        <View style={[styles.card, { overflow: 'hidden' }]}>
          <LinearGradient
            colors={['#10B981', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130, opacity: 0.15 }}
          />
          
          <TouchableOpacity 
            style={styles.headerInfo} 
            activeOpacity={0.7}
            onPress={() => router.push('/profile/edit-details')}
          >
            <View style={{ width: 104, height: 104, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Svg width={104} height={104} style={{ position: 'absolute' }}>
                <Circle
                  stroke="#F3F4F6"
                  fill="none"
                  cx={52}
                  cy={52}
                  r={48}
                  strokeWidth={4}
                />
                <Circle
                  stroke="#10B981"
                  fill="none"
                  cx={52}
                  cy={52}
                  r={48}
                  strokeWidth={4}
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={(2 * Math.PI * 48) - ((completed / total) * (2 * Math.PI * 48))}
                  strokeLinecap="round"
                  transform="rotate(-90 52 52)"
                />
              </Svg>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={[styles.avatar, { marginBottom: 0, borderWidth: 0 }]} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', borderWidth: 0, marginBottom: 0 }]}>
                  <Text style={{ color: '#047857', fontSize: 32, fontFamily: 'Outfit_700Bold' }}>{getInitials(user.name)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
              <Feather name="calendar" size={14} color="#6B7280" />
              <Text style={{ color: '#6B7280', fontSize: 13, fontFamily: 'Outfit_500Medium', marginLeft: 6 }}>
                {memberSince}
              </Text>
            </View>

            {user.bio ? (
              <Text style={{ color: '#374151', fontSize: 14, fontFamily: 'Outfit_400Regular', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20, fontStyle: 'italic' }}>
                "{user.bio}"
              </Text>
            ) : null}

            {completed < total ? (
              <Text style={styles.completionText}>{completed} out of {total} steps complete</Text>
            ) : (
              <Text style={styles.completionText}>100% Profile Complete</Text>
            )}
            <Text style={styles.editProfileText}>Tap to edit profile</Text>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {ratingInfo.count > 0 ? Number(ratingInfo.avg).toFixed(1) : 'New'} 
                {ratingInfo.count > 0 && <FontAwesome5 name="star" size={14} color="#F59E0B" solid style={{ marginLeft: 4 }} />}
              </Text>
              <Text style={styles.statLabel}>
                {ratingInfo.count > 0 ? `${ratingInfo.count} Rating${ratingInfo.count !== 1 ? 's' : ''}` : 'Rating'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userData?.stats?.totalRides || 0}</Text>
              <Text style={styles.statLabel}>Rides</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userData?.stats?.mates || 0}</Text>
              <Text style={styles.statLabel}>Mates</Text>
            </View>
          </View>
          
          <View style={[styles.reliabilityBanner, { backgroundColor: reliability.bgColor, borderColor: reliability.borderColor }]}>
            <Feather name={reliability.icon as any} size={16} color={reliability.color} style={{ marginRight: 8 }} />
            <Text style={[styles.reliabilityText, { color: reliability.color }]}>{reliability.text}</Text>
          </View>
        </View>

        {/* CARD 2: Trust & Safety */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trust & Safety</Text>
          <Text style={styles.cardSubtitle}>Verified profiles get 3x more ride requests.</Text>
          
          <View style={styles.badgesContainer}>
            {renderTrustBadge('shield', 'Govt ID', user.govtIdStatus as any, () => {
              if (user.govtIdStatus === 'verified') {
                showAlert("Notification", 'Your Govt ID is already verified!');
              } else if (user.govtIdStatus === 'pending') {
                showAlert("Notification", 'Your Govt ID is currently under review. We will notify you once it is verified.');
              } else {
                router.push('/profile/verify-id');
              }
            })}
            {renderTrustBadge('mail', 'Email', authUser?.emailVerified ? 'verified' : 'unverified', async () => {
              if (authUser?.emailVerified) {
                showAlert("Verified", "Your email is already verified.");
              } else {
                try {
                  if (authUser) {
                    const lastSentStr = await AsyncStorage.getItem(`email_verify_${authUser.uid}`);
                    if (lastSentStr) {
                      const lastSent = parseInt(lastSentStr, 10);
                      if (Date.now() - lastSent < 60 * 60 * 1000) {
                        showAlert("Wait", "An email was already sent recently. Please try again after 1 hour.");
                        return;
                      }
                    }
                    const { sendEmailVerification } = await import('firebase/auth');
                    await sendEmailVerification(authUser);
                    await AsyncStorage.setItem(`email_verify_${authUser.uid}`, Date.now().toString());
                    showAlert("Verification Sent", "A verification link has been sent to your registered email. Please check your inbox and click the link, then refresh the app.");
                  }
                } catch (e: any) {
                  showAlert("Error", "Could not send verification email. You may have sent too many requests recently. Try again later.");
                }
              }
            })}
            {renderTrustBadge('smartphone', 'Phone', userData?.phone ? 'verified' : (userData?.pendingPhone ? 'pending' : 'unverified'), () => {
              if (userData?.phone) {
                showAlert('Verified', 'Your phone number is already verified.');
              } else if (userData?.pendingPhone) {
                showAlert('Verification Pending', 'We have received your phone number. Our team will call you shortly to verify it.');
              } else {
                router.push('/profile/verify-phone');
              }
            })}
          </View>
          
          <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
            {renderMenuItem('phone-call', 'Emergency Contacts', 'Add trusted contacts for safety', () => showAlert("Coming Soon", "You will be able to add emergency contacts for safety alerts soon."))}
          </View>
        </View>

        {/* CARD 3: Carpooling Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Carpooling Settings</Text>
          {renderMenuItem('sliders', 'Travel Preferences', 'Smoking, Music, Pets', () => router.push('/profile/preferences'))}
          {renderMenuItem('truck', 'Your Vehicles', hasVehicles ? 'Manage cars' : 'Add a car', () => router.push('/profile/vehicles'))}
        </View>

        {/* CARD 4: Account */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          {renderMenuItem('star', 'Ratings', undefined, () => showAlert("Coming Soon", "Detailed reviews and comments from other users will be available here soon."))}
          {renderMenuItem('lock', 'Password', undefined, () => router.push('/profile/change-password'))}
          {renderMenuItem('help-circle', 'Help & Support', undefined, () => router.push('/profile/help'))}
          
          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleCloseAccount}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: '#FFF3CD' }]}>
                <Feather name="pause-circle" size={20} color="#856404" />
              </View>
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemTitle}>Deactivate Account</Text>
                <Text style={styles.menuItemSubtitle}>Temporarily disable your profile</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0, marginTop: -10 }]} onPress={handleDeleteAccount}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
                <Feather name="trash-2" size={20} color="#EF4444" />
              </View>
              <View style={styles.menuItemTextContainer}>
                <Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>Delete Account</Text>
                <Text style={styles.menuItemSubtitle}>Permanently remove your data</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          {userData?.role === 'admin' && (
            <TouchableOpacity style={{ overflow: 'hidden', borderRadius: 16, marginTop: 16, marginBottom: -12 }} onPress={() => router.push('/admin')}>
              <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Feather name="shield" size={20} color="#FFF" style={{ position: 'absolute', left: 20, top: 16 }} />
                <Text style={[styles.logoutText, { color: '#FFF' }]}>Admin Dashboard</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={async () => {
            await AsyncStorage.clear();
            signOut(auth);
            router.replace('/');
          }}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: BottomTabInset + 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Lighter grey background for dashboard feel
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    // Accent Border
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    // Soft shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  headerInfo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  completionText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#10B981',
    textAlign: 'center',
  },
  editProfileText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: 'Outfit_500Medium',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    color: '#6B7280',
  },
  reliabilityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  reliabilityText: {
    color: '#065F46',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trustBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  trustBadgeVerified: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  trustBadgePending: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
  },
  badgeIconWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  badgeCheck: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgePlus: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#9CA3AF',
    borderRadius: 10,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  badgeTextVerified: {
    color: '#065F46',
  },
  badgeTextPending: {
    color: '#6B7280',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: '#374151',
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  logoutButton: {
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#DC2626',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  primaryButtonText: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
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
