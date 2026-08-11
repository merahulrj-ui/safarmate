import { showAlert } from '@/utils/alert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc, addDoc, getCountFromServer, limit, orderBy } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'dashboard' | 'verifications' | 'users' | 'rides';

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.substring(0, 2).toUpperCase();
};

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [stats, setStats] = useState({ users: 0, rides: 0, pending: 0, verified: 0 });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allRides, setAllRides] = useState<any[]>([]);
  
  // Selection State
  const [selectedVerification, setSelectedVerification] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);

  // Security State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginProcessing, setLoginProcessing] = useState(false);

  useEffect(() => {
    if (userData?.role === 'admin') {
      fetchData();
    }
  }, [activeTab, userData]);

  const fetchData = async () => {
    if (userData?.role !== 'admin') return; // CRITICAL SECURITY CHECK
    
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const pendingQuery = query(collection(db, 'users'), where('govtIdStatus', '==', 'pending'));
        const verifiedQuery = query(collection(db, 'users'), where('govtIdVerified', '==', true));
        const recentUsersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5));
        const recentRidesQ = query(collection(db, 'rides'), orderBy('createdAt', 'desc'), limit(5));

        const [
          usersCountSnap,
          ridesCountSnap,
          pendingCountSnap,
          verifiedCountSnap,
          recentUsersSnap,
          recentRidesSnap,
        ] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'rides')),
          getCountFromServer(pendingQuery),
          getCountFromServer(verifiedQuery),
          getDocs(recentUsersQ),
          getDocs(recentRidesQ),
        ]);

        setStats({
          users: usersCountSnap.data().count,
          rides: ridesCountSnap.data().count,
          pending: pendingCountSnap.data().count,
          verified: verifiedCountSnap.data().count
        });

        const rUsers: any[] = [];
        recentUsersSnap.forEach(d => rUsers.push({ id: d.id, ...d.data() }));
        setRecentUsers(rUsers);

        const rRides: any[] = [];
        recentRidesSnap.forEach(d => rRides.push({ id: d.id, ...d.data() }));
        setRecentRides(rRides);
      } else if (activeTab === 'verifications') {
        const q = query(collection(db, 'users'), where('govtIdStatus', '==', 'pending'));
        const snapshot = await getDocs(q);
        const users: any[] = [];
        snapshot.forEach(d => users.push({ id: d.id, ...d.data() }));
        setPendingUsers(users);
      } else if (activeTab === 'users') {
        const snapshot = await getDocs(collection(db, 'users'));
        const users: any[] = [];
        snapshot.forEach(d => users.push({ id: d.id, ...d.data() }));
        setAllUsers(users);
      } else if (activeTab === 'rides') {
        const snapshot = await getDocs(collection(db, 'rides'));
        const rides: any[] = [];
        snapshot.forEach(d => rides.push({ id: d.id, ...d.data() }));
        setAllRides(rides);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (userId: string, decision: 'approved' | 'rejected') => {
    setProcessing(true);
    try {
      const isApproved = decision === 'approved';
      await updateDoc(doc(db, 'users', userId), {
        govtIdStatus: isApproved ? 'verified' : 'rejected',
        govtIdVerified: isApproved,
        pendingGovtIdFront: null,
        pendingGovtIdBack: null,
      });

      if (!isApproved) {
        await addDoc(collection(db, 'notifications'), {
          userId: userId,
          type: 'REJECTED_ID',
          title: 'ID Verification Failed',
          body: 'Your submitted ID was rejected because it was unclear or invalid. Please upload a clear photo of your ID again.',
          createdAt: new Date().toISOString(),
          read: false
        });
      }

      showAlert('Success', `User has been ${decision}.`);
      
      setSelectedVerification(null);
      fetchData();
    } catch (error) {
      showAlert('Error', 'Failed to update user.');
    } finally {
      setProcessing(false);
    }
  };

  const renderTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer} contentContainerStyle={{ paddingHorizontal: 16 }}>
      {(['dashboard', 'verifications', 'users', 'rides'] as Tab[]).map((tab) => (
        <TouchableOpacity 
          key={tab}
          style={[styles.tabButton, activeTab === tab && styles.tabButtonActive, { paddingHorizontal: 16 }]}
          onPress={() => {
            setActiveTab(tab);
            setSelectedVerification(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderDashboard = () => {
    if (loading) return <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />;
    return (
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={[styles.contentContainer, { maxWidth: 800, alignSelf: 'center', width: '100%' }]} 
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontFamily: 'Outfit_700Bold', color: '#111827' }}>Dashboard</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4, fontFamily: 'Outfit_400Regular' }}>Welcome back, Admin 👋</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 32 }}>
          <View style={[styles.statCard, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }]}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>👥</Text>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>{stats.users}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>🚗</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.rides}</Text>
            <Text style={styles.statLabel}>Total Rides</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>⏳</Text>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending ID</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)' }]}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>✅</Text>
            <Text style={[styles.statValue, { color: '#22C55E' }]}>{stats.verified}</Text>
            <Text style={styles.statLabel}>Verified Users</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Recent Users</Text>
        {recentUsers.map((u) => (
          <View key={u.id} style={[styles.listItem, { paddingVertical: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {u.avatar ? (
                <Image source={{ uri: u.avatar }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Outfit_700Bold', color: '#6B7280', fontSize: 16 }}>{getInitials(u.name || u.firstName || 'User')}</Text>
                </View>
              )}
              <View>
                <Text style={styles.listName}>{u.name || 'Anonymous'}</Text>
                <Text style={styles.listSub}>{u.email}</Text>
              </View>
            </View>
            {u.govtIdVerified ? (
              <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: '#22C55E', fontSize: 10, fontFamily: 'Outfit_700Bold' }}>✅ Verified</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: '#6B7280', fontSize: 10, fontFamily: 'Outfit_700Bold' }}>Unverified</Text>
              </View>
            )}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 16 }]}>Recent Rides</Text>
        {recentRides.map((r) => (
          <View key={r.id} style={[styles.listItem, { paddingVertical: 12 }]}>
             <View style={{ flex: 1 }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                 <Text style={styles.listName} numberOfLines={1}>{r.from} → {r.to}</Text>
                 <Text style={{ fontFamily: 'Outfit_700Bold', color: '#10B981', fontSize: 14 }}>₹{r.price}</Text>
               </View>
               <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                 <Text style={[styles.listSub, { fontSize: 12 }]}>by {r.driverName}</Text>
                 <Text style={[styles.listSub, { fontSize: 12 }]}>{r.seatsAvailable} seats left</Text>
               </View>
             </View>
          </View>
        ))}
        {recentRides.length === 0 && <Text style={{ textAlign: 'center', color: '#9CA3AF', marginVertical: 20 }}>No rides yet</Text>}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const renderVerifications = () => {
    if (selectedVerification) {
      return (
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={[styles.contentContainer, { maxWidth: 800, alignSelf: 'center', width: '100%' }]} 
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
            onPress={() => setSelectedVerification(null)}
          >
            <Feather name="arrow-left" size={20} color="#6B7280" />
            <Text style={{ marginLeft: 8, color: '#6B7280', fontFamily: 'Outfit_600SemiBold' }}>Back to List</Text>
          </TouchableOpacity>

          <View style={styles.userCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              {selectedVerification.avatar ? (
                <Image source={{ uri: selectedVerification.avatar }} style={styles.userAvatar} />
              ) : (
                <View style={[styles.userAvatar, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontFamily: 'Outfit_700Bold', color: '#6B7280', fontSize: 20 }}>{getInitials(selectedVerification.name || selectedVerification.firstName || 'User')}</Text>
                </View>
              )}
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.userName}>{selectedVerification.name || 'Unknown User'}</Text>
                <Text style={styles.userEmail}>{selectedVerification.email}</Text>
              </View>
            </View>

            <Text style={styles.docTypeBadge}>{selectedVerification.govtIdType || 'Unknown ID Type'}</Text>
          </View>

          <Text style={styles.sectionTitle}>Front Side</Text>
          {selectedVerification.pendingGovtIdFront ? (
            <Image source={{ uri: selectedVerification.pendingGovtIdFront }} style={styles.idImage} />
          ) : (
            <Text style={styles.noImageText}>No front image uploaded.</Text>
          )}

          {selectedVerification.govtIdType !== 'PAN' && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Back Side</Text>
              {selectedVerification.pendingGovtIdBack ? (
                <Image source={{ uri: selectedVerification.pendingGovtIdBack }} style={styles.idImage} />
              ) : (
                <Text style={styles.noImageText}>No back image uploaded.</Text>
              )}
            </>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleDecision(selectedVerification.id, 'rejected')}
              disabled={processing}
            >
              <Feather name="x" size={20} color="#DC2626" />
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleDecision(selectedVerification.id, 'approved')}
              disabled={processing}
            >
              <Feather name="check" size={20} color="#FFF" />
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    if (loading) return <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />;
    if (pendingUsers.length === 0) return (
      <View style={styles.emptyState}>
        <Feather name="check-circle" size={48} color="#10B981" />
        <Text style={styles.emptyStateText}>All caught up!</Text>
        <Text style={styles.emptyStateSubtext}>No pending verifications at the moment.</Text>
      </View>
    );

    return (
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={[styles.contentContainer, { maxWidth: 800, alignSelf: 'center', width: '100%' }]} 
        showsVerticalScrollIndicator={false}
      >
        {pendingUsers.map(u => (
          <TouchableOpacity key={u.id} style={styles.listItem} onPress={() => setSelectedVerification(u)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="shield" size={24} color="#F59E0B" style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.listName}>{u.name || u.firstName || 'Unknown User'}</Text>
                <Text style={styles.listSub}>{u.govtIdType || 'ID'} • Pending</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderUsers = () => {
    if (loading) return <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />;
    return (
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={[styles.contentContainer, { maxWidth: 800, alignSelf: 'center', width: '100%' }]} 
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Total Users: {allUsers.length}</Text>
        {allUsers.map(u => (
          <View key={u.id} style={styles.listItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {u.avatar ? (
                <Image source={{ uri: u.avatar }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontFamily: 'Outfit_700Bold', color: '#6B7280', fontSize: 16 }}>{getInitials(u.name || u.firstName || 'User')}</Text>
                </View>
              )}
              <View>
                <Text style={styles.listName}>{u.name || u.firstName || 'Anonymous'}</Text>
                <Text style={styles.listSub}>{u.email || u.phone || 'No contact info'}</Text>
              </View>
            </View>
            {u.govtIdVerified ? (
               <Feather name="check-circle" size={20} color="#10B981" />
            ) : u.role === 'admin' ? (
               <View style={{ backgroundColor: '#111827', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                 <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Outfit_700Bold' }}>ADMIN</Text>
               </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderRides = () => {
    if (loading) return <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 40 }} />;
    return (
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={[styles.contentContainer, { maxWidth: 800, alignSelf: 'center', width: '100%' }]} 
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Total Rides: {allRides.length}</Text>
        {allRides.map(r => (
          <View key={r.id} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Feather name="map-pin" size={14} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.listName} numberOfLines={1}>{r.from || 'Unknown Origin'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="flag" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.listName} numberOfLines={1}>{r.to || 'Unknown Destination'}</Text>
              </View>
              <Text style={[styles.listSub, { marginTop: 8 }]}>Driver ID: {r.driverId?.substring(0,8)}...</Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: 16 }}>
              <Text style={{ fontFamily: 'Outfit_700Bold', color: '#111827' }}>₹{r.price || 0}</Text>
              <Text style={{ color: '#6B7280', fontSize: 12 }}>{r.seatsAvailable || 0} seats</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10B981" />
      </SafeAreaView>
    );
  }

  if (userData?.role !== 'admin') {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Feather name="shield-off" size={64} color="#EF4444" />
        <Text style={{ fontSize: 24, fontFamily: 'Outfit_700Bold', color: '#111827', marginTop: 16 }}>Unauthorized Access</Text>
        <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          This area is restricted to administrators only. Your activity has been logged.
        </Text>
        <TouchableOpacity style={{ marginTop: 24, padding: 12, backgroundColor: '#111827', borderRadius: 8 }} onPress={() => router.replace('/')}>
          <Text style={{ color: '#FFF', fontFamily: 'Outfit_700Bold' }}>Return to Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleLogin = async () => {
    if (!usernameInput || !passwordInput) {
      setLoginError('Please enter both fields');
      return;
    }

    try {
      setLoginProcessing(true);
      const authDoc = await getDoc(doc(db, 'settings', 'adminAuth'));
      
      if (authDoc.exists()) {
        const storedUsername = authDoc.data().username;
        const storedPasswordHash = authDoc.data().password; // Now expects a hash in DB

        // Hash the user's input before comparing
        const inputHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          passwordInput
        );

        if (usernameInput === storedUsername && inputHash === storedPasswordHash) {
          setIsAuthenticated(true);
          setLoginError('');
        } else {
          setLoginError('Invalid credentials');
        }
      } else {
        setLoginError('Admin credentials not configured in DB.');
      }
    } catch (error) {
      setLoginError('Network or Database Error');
    } finally {
      setLoginProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { position: 'absolute', left: 16, top: 12 }]}>
            <Feather name="chevron-left" size={28} color="#111827" />
          </TouchableOpacity>
        </View>

        <Feather name="lock" size={64} color="#10B981" />
        <Text style={{ fontSize: 24, fontFamily: 'Outfit_700Bold', color: '#111827', marginTop: 16, marginBottom: 8 }}>Admin Authentication</Text>
        <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 32 }}>Please enter your secondary credentials to access the secure panel.</Text>

        <View style={{ width: '100%', marginBottom: 16 }}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter username" 
            value={usernameInput} 
            onChangeText={setUsernameInput} 
            autoCapitalize="none" 
            autoCorrect={false}
            maxLength={50}
          />
        </View>

        <View style={{ width: '100%', marginBottom: 8 }}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter password" 
            value={passwordInput} 
            onChangeText={setPasswordInput} 
            secureTextEntry 
            maxLength={50}
          />
        </View>

        {loginError ? <Text style={{ color: '#EF4444', marginBottom: 16, fontFamily: 'Outfit_600SemiBold' }}>{loginError}</Text> : <View style={{ height: 16, marginBottom: 16 }} />}

        <TouchableOpacity 
          style={{ width: '100%', backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 12, alignItems: 'center', opacity: loginProcessing ? 0.7 : 1 }}
          onPress={handleLogin}
          disabled={loginProcessing}
        >
          {loginProcessing ? (
             <ActivityIndicator color="#FFF" />
          ) : (
             <Text style={{ color: '#FFF', fontFamily: 'Outfit_700Bold', fontSize: 16 }}>Unlock Dashboard</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Super Admin Hub</Text>
        <TouchableOpacity onPress={fetchData} style={{ padding: 8 }}>
          <Feather name="refresh-cw" size={20} color="#10B981" />
        </TouchableOpacity>
      </View>
      
      {renderTabs()}

      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'verifications' && renderVerifications()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'rides' && renderRides()}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    maxHeight: 52,
  },
  tabButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minWidth: 100,
  },
  tabButtonActive: {
    borderBottomColor: '#10B981',
  },
  tabText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#10B981',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: '#6B7280',
  },
  userCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  docTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    color: '#065F46',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 8,
  },
  idImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    resizeMode: 'contain',
    backgroundColor: '#E5E7EB',
  },
  noImageText: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
    marginBottom: 40,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  approveButtonText: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  rejectButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectButtonText: {
    color: '#DC2626',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  emptyStateText: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  listName: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: '#111827',
  },
  listSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  inputLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: '#111827',
  },
});
