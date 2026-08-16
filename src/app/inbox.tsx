import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { BottomTabInset } from '@/constants/theme';
import LoginScreen from '@/components/LoginScreen';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';

export default function InboxScreen() {
  const router = useRouter();
  const { user: authUser, loading } = useAuth();
  const isLoggedIn = !!authUser;

  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);

  const cleanupOldConversation = async (convId: string) => {
    try {
      const messagesRef = collection(db, 'conversations', convId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      const batch = writeBatch(db);
      messagesSnapshot.forEach((msgDoc) => {
        batch.delete(msgDoc.ref);
      });
      
      const convRef = doc(db, 'conversations', convId);
      batch.delete(convRef);
      
      await batch.commit();
    } catch (e) {
    }
  };

  useEffect(() => {
    if (authUser) {
      const q = query(collection(db, 'conversations'), where('participants', 'array-contains', authUser.uid));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const chats: any[] = [];
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        
        querySnapshot.forEach((doc) => {
          const chatData = doc.data();
          const lastMsgTime = new Date(chatData.lastMessage?.createdAt || chatData.createdAt || 0).getTime();
          
          if (lastMsgTime < sevenDaysAgo) {
            // Background cleanup for old chats
            cleanupOldConversation(doc.id);
          } else {
            chats.push({ id: doc.id, ...chatData });
          }
        });
        
        // Sort descending by last message time
        chats.sort((a, b) => new Date(b.lastMessage?.createdAt || 0).getTime() - new Date(a.lastMessage?.createdAt || 0).getTime());
        setConversations(chats);
        setLoadingChats(false);
      }, (e) => {
        setLoadingChats(false);
      });

      return () => unsubscribe();
    }
  }, [authUser]);

  if (!isLoggedIn) {
    return <LoginScreen />;
  }



  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.pageTitle}>Inbox</Text>

        {loadingChats ? (
          <View style={styles.emptyStateContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="chatbubbles-outline" size={80} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              Messages from your passengers or drivers will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.conversationsList}>
            {conversations.map((conv) => {
              const getInitials = (n: string) => {
                if (!n) return 'U';
                const parts = n.trim().split(' ').filter(p => p.length > 0);
                if (parts.length === 0) return 'U';
                if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
              };

              const date = new Date(conv.lastMessage?.createdAt || conv.createdAt || 0);
              const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              
              const myUnreadCount = conv.unreadCounts ? (conv.unreadCounts[authUser.uid] || 0) : (conv.unreadCount > 0 && conv.lastMessage?.senderId !== authUser.uid ? conv.unreadCount : 0);
              const isUnread = myUnreadCount > 0;
              
              const otherUserId = conv.participants?.find((p: string) => p !== authUser.uid) || authUser.uid;
              const displayUser = conv.users ? conv.users[otherUserId] : conv.user;
              const displayName = displayUser?.name || 'Unknown';
              const displayAvatar = displayUser?.avatar;
              const displayId = displayUser?.id || otherUserId;

              return (
                <TouchableOpacity 
                  key={conv.id} 
                  style={styles.conversationCard} 
                  activeOpacity={0.7}
                  onPress={() => {
                    router.push({
                      pathname: '/chat/[id]',
                      params: { 
                        id: conv.id,
                        name: displayName,
                        avatar: displayAvatar,
                        otherUserId: displayId
                      }
                    });
                  }}
                >
                  
                  <View style={styles.avatarContainer}>
                    {displayId === 'team' ? (
                      <View style={[styles.avatar, { backgroundColor: 'transparent', padding: 0 }]}>
                        <Image source={require('../../assets/images/icon.png')} style={{ width: 60, height: 60, borderRadius: 12, resizeMode: 'contain' }} />
                      </View>
                    ) : displayAvatar && !String(displayAvatar).includes('ui-avatars') && !String(displayAvatar).includes('pravatar') ? (
                      <Image source={{ uri: displayAvatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.initialsAvatar]}>
                        <Text style={styles.initialsText}>{getInitials(displayName)}</Text>
                      </View>
                    )}
                    {isUnread && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{myUnreadCount}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.messageContent}>
                    <Text style={styles.userName} numberOfLines={1}>{displayId === 'team' ? 'SafarMile Team' : displayName}</Text>
                    <Text 
                      style={[styles.messagePreview, isUnread ? styles.messagePreviewUnread : styles.messagePreviewRead]} 
                      numberOfLines={1}
                    >
                      {conv.lastMessage?.senderId === displayId ? '' : 'You: '}
                      {conv.lastMessage?.content || ''}
                    </Text>
                  </View>

                  <View style={styles.rightContent}>
                    <Text style={styles.timeText}>{timeStr} • {dateStr}</Text>
                    <Feather name="chevron-right" size={20} color="#9CA3AF" style={{ marginTop: 4 }} />
                  </View>
                </TouchableOpacity>
              );
            })}
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
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Outfit_500Medium',
    maxWidth: '80%',
    lineHeight: 24,
  },
  conversationsList: {
    gap: 16,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
  },
  initialsAvatar: {
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    backgroundColor: '#10B981',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  messageContent: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginBottom: 4,
  },
  rightContent: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: '#9CA3AF',
  },
  messagePreview: {
    fontSize: 14,
  },
  messagePreviewUnread: {
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
  },
  messagePreviewRead: {
    fontFamily: 'Outfit_500Medium',
    color: '#6B7280',
  },
});
