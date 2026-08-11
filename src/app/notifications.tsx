import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const notifs: any[] = [];
        querySnapshot.forEach((doc) => {
          notifs.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort descending by createdAt
        notifs.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
        
        setNotifications(notifs);
        setLoading(false);
      },
      (e) => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleNotificationClick = async (notif: any) => {
    // Mark as read
    if (!notif.read) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), {
          read: true
        });
        // Optimistically update UI
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      } catch (e) {
      }
    }
    
    // Navigate to ride
    if (notif.rideId) {
      router.push(`/ride/${notif.rideId}`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="notifications-off-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>When someone books your ride or accepts your request, it will appear here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {notifications.map((notif) => (
            <TouchableOpacity 
              key={notif.id} 
              style={[styles.notificationCard, !notif.read && styles.unreadCard]}
              onPress={() => handleNotificationClick(notif)}
            >
              <View style={styles.iconContainer}>
                {notif.type === 'REQUEST' ? (
                  <Ionicons name="person-add" size={24} color="#10B981" />
                ) : notif.type === 'ACCEPTED' ? (
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                ) : notif.type === 'system' ? (
                  <Ionicons name="shield-checkmark" size={24} color="#3B82F6" />
                ) : notif.type === 'REJECTED' || notif.type === 'CANCELLED' ? (
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                ) : (
                  <Ionicons name="notifications" size={24} color="#6B7280" />
                )}
              </View>
              <View style={styles.contentContainer}>
                <Text style={styles.title}>{notif.title}</Text>
                <Text style={styles.body}>{notif.body}</Text>
                <Text style={styles.time}>
                  {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              {!notif.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollContent: {
    padding: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  unreadCard: {
    backgroundColor: '#F0FDFA',
    borderColor: '#D1FAE5',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: '#4B5563',
    marginBottom: 8,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    alignSelf: 'center',
    marginLeft: 8,
  }
});
