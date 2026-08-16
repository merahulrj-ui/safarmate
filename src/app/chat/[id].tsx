import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { showAlert } from '@/utils/alert';
import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  where,
  updateDoc,
  setDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';

export default function ChatScreen() {
  const router = useRouter();
  const { id, name, avatar, otherUserId } = useLocalSearchParams();
  const { user: authUser } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isReadByOther, setIsReadByOther] = useState(false);
  
  // Rating & Blocking State
  const [isChatBlocked, setIsChatBlocked] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);

  const getLocalYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Check if chat should be blocked (no active rides in future/today)
  useEffect(() => {
    if (!authUser || !otherUserId || otherUserId === 'team') return;

    const checkActiveRidesAndRatings = async () => {
      try {
        // 1. Check if there is ANY active ride between these two users
        // Query rides where driver is authUser and passenger is otherUserId
        const q1 = query(
          collection(db, 'rides'),
          where('driverId', '==', authUser.uid),
          where('passengerIds', 'array-contains', otherUserId)
        );
        // Query rides where driver is otherUserId and passenger is authUser
        const q2 = query(
          collection(db, 'rides'),
          where('driverId', '==', otherUserId),
          where('passengerIds', 'array-contains', authUser.uid)
        );

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
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

        const now = new Date().getTime();
        let hasAnyRide = false;
        let hasActiveRide = false;
        
        const processDoc = (docSnap: any) => {
          hasAnyRide = true;
          const data = docSnap.data();
          
          if (data.status === 'CANCELLED') {
            return;
          }
          
          const passengerId = data.driverId === authUser.uid ? otherUserId : authUser.uid;
          const userBooking = data.bookings?.find((b: any) => b.passengerId === passengerId);
          if (userBooking && (userBooking.status === 'CANCELLED' || userBooking.status === 'REJECTED')) {
            return;
          }

          const depIso = getValidDateIso(data.date, data.time);
          // A ride is active until 2 hours after pickup time
          const rideEndTime = new Date(depIso).getTime() + (2 * 60 * 60 * 1000);
          if (rideEndTime >= now) {
            hasActiveRide = true;
          }
        };

        snap1.forEach(processDoc);
        snap2.forEach(processDoc);

        // Block chat ONLY if they had a ride together, and ALL rides are over.
        // If they have no rides (pre-booking) or an active ride, don't block.
        const shouldBlock = hasAnyRide && !hasActiveRide;
        setIsChatBlocked(shouldBlock);

        // If blocked, check if current user already rated the other user
        if (shouldBlock) {
          const ratingQ = query(
            collection(db, 'ratings'),
            where('fromUserId', '==', authUser.uid),
            where('toUserId', '==', otherUserId)
          );
          const ratingSnap = await getDocs(ratingQ);
          if (!ratingSnap.empty) {
            setHasRated(true);
            setRatingValue(ratingSnap.docs[0].data().rating);
          }
        }
      } catch (error) {
        console.error("Error checking rides/ratings:", error);
      }
    };

    checkActiveRidesAndRatings();
  }, [authUser, otherUserId]);

  useEffect(() => {
    if (!id || !otherUserId) return;
    const unsubConv = onSnapshot(doc(db, 'conversations', id as string), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.unreadCounts && data.unreadCounts[otherUserId as string] === 0) {
          setIsReadByOther(true);
        } else {
          setIsReadByOther(false);
        }
      }
    });
    return () => unsubConv();
  }, [id, otherUserId]);

  useEffect(() => {
    if (!id || !authUser) return;

    // Listen to messages subcollection (descending for inverted list)
    const q = query(
      collection(db, 'conversations', id as string, 'messages'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Hide the old welcome message bubble since we now use the custom UI header
        if (data.senderId === 'team' && data.content === 'Welcome to SafarMile! Start booking or publishing rides today.') {
          return;
        }
        msgs.push({ id: doc.id, ...data });
      });
      setMessages(msgs);
      
      // Mark as read when the chat is opened, regardless of who sent the last message
      const convRef = doc(db, 'conversations', id as string);
      getDoc(convRef).then((convSnap) => {
        if (convSnap.exists()) {
          const data = convSnap.data();
          if (data.unreadCounts?.[authUser.uid] !== 0 || data.unreadCount !== 0) {
            updateDoc(convRef, {
              [`unreadCounts.${authUser.uid}`]: 0,
              unreadCount: 0
            }).catch(() => {});
          }
        }
      }).catch(() => {});
    });

    return () => unsubscribe();
  }, [id, authUser]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !id || !authUser) return;

    // 1. Length Limit (max 500 chars) to prevent database flooding
    let msgText = newMessage.trim().substring(0, 500);

    // 2. Phishing/Spam Protection: Remove URLs
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/gi;
    msgText = msgText.replace(urlRegex, "[Link Removed for Security]");

    // 3. Command/Code Injection Protection
    const cmdRegex = /(exec\(|eval\(|system\(|cmd\.exe|\/bin\/bash|\/bin\/sh)/gi;
    msgText = msgText.replace(cmdRegex, "[Command Blocked]");

    setNewMessage(''); // optimistic clear

    try {
      const messageData = {
        senderId: authUser.uid,
        content: msgText,
        createdAt: new Date().toISOString()
      };

      // Add to messages subcollection
      await addDoc(collection(db, 'conversations', id as string, 'messages'), messageData);

      // Update lastMessage on the conversation document
      await updateDoc(doc(db, 'conversations', id as string), {
        lastMessage: messageData,
        [`unreadCounts.${otherUserId}`]: increment(1),
        unreadCount: increment(1) // fallback
      });
    } catch (e) {
    }
  };

  const getInitials = (n: string) => {
    if (!n) return 'U';
    const parts = n.trim().split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === authUser?.uid;
    const date = new Date(item.createdAt);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperOther]}>
        {!isMe && (
          avatar && !String(avatar).includes('ui-avatars') ? (
            <Image source={{ uri: avatar as string }} style={styles.messageAvatar} />
          ) : (
            <View style={[styles.messageAvatar, styles.initialsAvatar]}>
              <Text style={styles.initialsText}>{getInitials(name as string)}</Text>
            </View>
          )
        )}
        
        <View style={styles.messageBubbleContainer}>
          <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
            <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
              {item.content}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 6 }}>
            <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther, { marginTop: 0 }]}>{timeStr}</Text>
            {isMe && (
              <Ionicons 
                name="checkmark-done" 
                size={16} 
                color={isReadByOther ? "#3b82f6" : "#9CA3AF"} 
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>

        {isMe && (
          authUser?.photoURL && !String(authUser.photoURL).includes('ui-avatars') ? (
            <Image source={{ uri: authUser.photoURL }} style={[styles.messageAvatar, { marginLeft: 8, marginRight: 0 }]} />
          ) : (
            <View style={[styles.messageAvatar, styles.initialsAvatar, { marginLeft: 8, marginRight: 0 }]}>
              <Text style={styles.initialsText}>{getInitials(authUser?.displayName || 'Me')}</Text>
            </View>
          )
        )}
      </View>
    );
  };

  const renderWelcomeHeader = () => {
    if (otherUserId !== 'team') return null;

    return (
      <View style={[styles.messageWrapper, styles.messageWrapperOther, { marginBottom: 32 }]}>
        <View style={[styles.messageAvatar, { backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }]}>
          <Feather name="shield" size={14} color="#FFF" />
        </View>
        
        <View style={[styles.messageBubbleContainer, { maxWidth: '85%' }]}>
          <View style={[styles.messageBubble, styles.messageBubbleOther]}>
            <Text style={[styles.messageText, styles.messageTextOther, { fontFamily: 'Outfit_700Bold', marginBottom: 8 }]}>
              Welcome to SafarMile! 🎉
            </Text>
            <Text style={[styles.messageText, styles.messageTextOther, { marginBottom: 8, lineHeight: 22 }]}>
              Hi {authUser?.displayName || 'User'}, we're thrilled to have you here.
            </Text>
            <Text style={[styles.messageText, styles.messageTextOther, { lineHeight: 22 }]}>
              SafarMile connects verified drivers with empty seats to passengers travelling the same way.
            </Text>
            <Text style={[styles.messageText, styles.messageTextOther, { marginTop: 8, color: '#10B981', fontFamily: 'Outfit_600SemiBold' }]}>
              ✓ 100% Ad-Free Experience
            </Text>
            
            <TouchableOpacity 
              style={{ marginTop: 16, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' }} 
              onPress={() => router.push('/')}
            >
              <Text style={{ color: '#10B981', fontFamily: 'Outfit_700Bold', fontSize: 14 }}>Find a Ride</Text>
              <Feather name="arrow-right" size={16} color="#10B981" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginTop: 6 }}>
            <Text style={[styles.timeText, styles.timeTextOther, { marginTop: 0 }]}>Automated Message</Text>
          </View>
        </View>
      </View>
    );
  };

  const submitRating = async (rating: number) => {
    if (!authUser || !otherUserId) {
      return;
    }
    if (submittingRating) {
      return;
    }
    
    setSubmittingRating(true);
    try {
      const ratingData = {
        fromUserId: authUser.uid,
        toUserId: otherUserId as string,
        rating: rating,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'ratings'), ratingData);
      
      setHasRated(true);
      setRatingValue(rating);
    } catch (e: any) {
      console.error(e);
      showAlert("Error", "Could not submit rating. " + e.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  const renderFooterInput = () => {
    if (otherUserId === 'team') {
      return (
        <View style={[styles.footer, { justifyContent: 'center', backgroundColor: '#F9FAFB', paddingVertical: 16 }]}>
          <Text style={{ color: '#6B7280', fontSize: 14, fontFamily: 'Outfit_500Medium', textAlign: 'center' }}>
            This is an automated system message. Replies are disabled.
          </Text>
        </View>
      );
    }

    if (isChatBlocked) {
      return (
        <View style={[styles.footer, { flexDirection: 'column', alignItems: 'center', paddingVertical: 24, backgroundColor: '#F9FAFB' }]}>
          <Text style={{ color: '#111827', fontSize: 16, fontFamily: 'Outfit_700Bold', marginBottom: 12 }}>
            {hasRated ? 'You rated this user' : 'Ride ended or cancelled'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                disabled={hasRated || submittingRating}
                onPress={() => submitRating(star)}
                activeOpacity={0.7}
              >
                <Feather 
                  name="star" 
                  size={36} 
                  color={star <= ratingValue ? "#F59E0B" : "#D1D5DB"} 
                />
              </TouchableOpacity>
            ))}
          </View>
          {submittingRating && <Text style={{ color: '#6B7280', marginTop: 12, fontSize: 12 }}>Submitting...</Text>}
        </View>
      );
    }

    return (
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.attachButton}
          onPress={() => showAlert('Coming Soon', 'File attachments will be available in the next update!')}
        >
          <Feather name="plus" size={24} color="#9CA3AF" />
        </TouchableOpacity>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor="#9CA3AF"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
        </View>

        <TouchableOpacity 
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: '100%', height: '100%', borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="send" size={18} color="#FFF" style={{ marginLeft: -2, marginTop: 2 }} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.navigate('/inbox')}>
            <Feather name="chevron-left" size={28} color="#111827" />
          </TouchableOpacity>
          
          <View style={styles.headerProfile}>
            {otherUserId === 'team' ? (
              <View style={[styles.headerAvatar, { backgroundColor: 'transparent', padding: 0 }]}>
                <Image source={require('../../../assets/images/icon.png')} style={{ width: 40, height: 40, borderRadius: 8, resizeMode: 'contain' }} />
              </View>
            ) : avatar && !String(avatar).includes('ui-avatars') ? (
              <Image source={{ uri: avatar as string }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.initialsAvatar, { width: 40, height: 40, borderRadius: 20 }]}>
                <Text style={[styles.initialsText, { fontSize: 16 }]}>{getInitials(name as string)}</Text>
              </View>
            )}
            <Text style={styles.headerName}>{otherUserId === 'team' ? 'SafarMile Team' : name}</Text>
          </View>
        </View>

        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={renderMessage}
          ListFooterComponent={renderWelcomeHeader} // Since it's inverted, header goes to footer
          contentContainerStyle={styles.messageList}
          inverted={true}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />

        {/* Input Footer */}
        {renderFooterInput()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    ...Platform.select({
      web: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        zIndex: 10,
      }
    })
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
  },
  initialsAvatar: {
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  headerName: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    marginLeft: 12,
  },
  messageList: {
    padding: 20,
    paddingTop: 40, // since inverted, top is visually the bottom padding
  },
  messageWrapper: {
    flexDirection: 'row',
    marginTop: 24, // since inverted, margin top separates from newer messages below
    alignItems: 'flex-end',
  },
  messageWrapperMe: {
    justifyContent: 'flex-end',
  },
  messageWrapperOther: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 16,
  },
  messageBubbleContainer: {
    maxWidth: '75%',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  messageBubbleMe: {
    backgroundColor: '#10B981',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextMe: {
    color: '#FFF',
  },
  messageTextOther: {
    color: '#111827',
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
  },
  timeTextMe: {
    textAlign: 'right',
  },
  timeTextOther: {
    textAlign: 'left',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  inputContainer: {
    flex: 1,
    marginHorizontal: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
    marginBottom: 4,
  },
  input: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: '#111827',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  }
});
