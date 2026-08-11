import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 20; // Fallback for web/android
  const { user: authUser } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    if (authUser) {
      const q = query(collection(db, 'conversations'), where('participants', 'array-contains', authUser.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let total = 0;
        snapshot.forEach(doc => {
          const data = doc.data();
          const myUnread = data.unreadCounts ? (data.unreadCounts[authUser.uid] || 0) : (data.unreadCount && data.lastMessage?.senderId !== authUser.uid ? data.unreadCount : 0);
          total += myUnread;
        });
        setUnreadTotal(total);
      });
      return () => unsubscribe();
    } else {
      setUnreadTotal(0);
    }
  }, [authUser]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          elevation: 0,
          shadowOpacity: 0,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Outfit_600SemiBold',
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Feather name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="publish"
        options={{
          title: 'Publish',
          tabBarIcon: ({ color, size }) => (
            <Feather name="plus-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: 'Your rides',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined,
          tabBarBadgeStyle: { backgroundColor: '#EF4444' },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
      
      {/* Hide the old explore tab if it still exists */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
      
      {/* Hide the chat screen from the tab bar list but keep navbar visible */}
      <Tabs.Screen
        name="chat/[id]"
        options={{
          href: null,
        }}
      />

      {/* Hide the search results and ride details screens from the tab bar */}
      <Tabs.Screen
        name="search-results"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ride/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      
      {/* Hide new profile sub-screens from tab bar */}
      <Tabs.Screen name="profile/edit-details" options={{ href: null }} />
      <Tabs.Screen name="profile/verify-phone" options={{ href: null }} />
      <Tabs.Screen name="profile/verify-id" options={{ href: null }} />
      <Tabs.Screen name="profile/change-password" options={{ href: null }} />
      <Tabs.Screen name="profile/preferences" options={{ href: null }} />
      <Tabs.Screen name="profile/vehicles" options={{ href: null }} />
      <Tabs.Screen name="profile/help" options={{ href: null }} />
      {/* Hide admin screens from tab bar */}
      <Tabs.Screen name="admin/index" options={{ href: null }} />
    </Tabs>
  );
}
