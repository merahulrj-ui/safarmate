import { showAlert } from '@/utils/alert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { sendTelegramNotification } from '@/lib/telegram';

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  const recaptchaRef = useRef<FirebaseRecaptchaRef>(null);

  useFocusEffect(
    useCallback(() => {
      // Clear state when user comes to this screen (especially if logged in as a different user)
      setPhoneNumber('');
      setVerificationId('');
      setVerificationCode('');
      setPhoneLoading(false);
    }, [user?.uid])
  );

  const sendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      showAlert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    
    setPhoneLoading(true);
    const finalPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    
    try {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.uid), {
        pendingPhone: finalPhone,
        phoneVerificationStatus: 'pending'
      });

      // Send Telegram Notification to Admin
      const userName = user.displayName || user.email || 'A User';
      const text = `🔔 <b>New Phone Verification Request</b>\n\n<b>Name:</b> ${userName}\n<b>Phone:</b> ${finalPhone}\n<b>User ID:</b> <code>${user.uid}</code>\n\nPlease call this number and verify from the database.`;
      
      await sendTelegramNotification(text);
      
      showAlert('Request Received', 'We will call you shortly to verify your phone number. You will receive a notification once verified.');
      router.navigate('/profile');
    } catch (err: any) {
      showAlert('Error', 'Failed to submit phone number. Please try again later.');
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/profile')} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Phone</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={{ padding: 20 }}>
        <TouchableOpacity style={styles.truecallerButton} onPress={() => showAlert('Notice', 'Truecaller 1-Tap Login will be available in the final update.')}>
          <Text style={styles.truecallerText}>Verify instantly with Truecaller</Text>
        </TouchableOpacity>

        <Text style={styles.orText}>OR REQUEST MANUAL VERIFICATION</Text>
        
        <View style={styles.infoBox}>
          <Feather name="phone-call" size={24} color="#10B981" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>How it works?</Text>
            <Text style={styles.infoDesc}>Enter your number below. Our team will call you to verify your identity. Once verified, you will receive a notification.</Text>
          </View>
        </View>

        <Text style={styles.inputLabel}>Enter Phone Number</Text>
        <View style={styles.phoneInputContainer}>
          <Text style={styles.countryCode}>+91</Text>
          <TextInput 
            style={styles.phoneInput}
            keyboardType="phone-pad"
            placeholder="9876543210"
            maxLength={10}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={sendOTP} disabled={phoneLoading}>
          {phoneLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Request Verification Call</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: '#111827',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center'
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1
  },
  infoTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#065F46',
    marginBottom: 4
  },
  infoDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: '#064E3B',
    lineHeight: 18
  },
  truecallerButton: {
    backgroundColor: '#0056D2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  truecallerText: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  orText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
  },
  countryCode: {
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: '#374151',
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: '#111827',
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
  },
  primaryButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  }
});
