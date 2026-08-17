import { showAlert } from '@/utils/alert';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { PhoneAuthProvider, linkWithCredential } from 'firebase/auth';
import FirebaseRecaptcha, { FirebaseRecaptchaRef } from '@/components/FirebaseRecaptcha';
import { useRef } from 'react';

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  const recaptchaRef = useRef<FirebaseRecaptchaRef>(null);

  const sendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      showAlert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    
    setPhoneLoading(true);
    const finalPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    recaptchaRef.current?.sendOTP(finalPhone);
  };

  const confirmOTP = async () => {
    if (verificationCode.length < 6) {
      showAlert('Error', 'Please enter 6 digit OTP');
      return;
    }
    
    if (!user || !auth.currentUser) return;
    
    setPhoneLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      await linkWithCredential(auth.currentUser, credential);

      const finalPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
      await updateDoc(doc(db, 'users', user.uid), {
        phone: finalPhone
      });
      
      showAlert('Success', 'Phone number verified successfully!');
      router.navigate('/profile');
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/credential-already-in-use') msg = 'This phone number is already linked to another account.';
      if (err.code === 'auth/invalid-verification-code') msg = 'Invalid OTP code.';
      showAlert('Error', msg);
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

      <FirebaseRecaptcha 
        ref={recaptchaRef}
        onVerificationId={(id) => {
          setVerificationId(id);
          setPhoneLoading(false);
          showAlert('OTP Sent', 'SMS has been sent to your phone.');
        }}
        onError={(err) => {
          setPhoneLoading(false);
          showAlert('Error', err);
        }}
      />

      <ScrollView style={{ padding: 20 }}>
        <TouchableOpacity style={styles.truecallerButton} onPress={() => showAlert('Notice', 'Truecaller 1-Tap Login requires Native Code and will be activated in the final APK.')}>
          <Text style={styles.truecallerText}>Verify instantly with Truecaller</Text>
        </TouchableOpacity>

        <Text style={styles.orText}>OR VERIFY VIA SMS</Text>

        {!verificationId ? (
          <>
            <Text style={styles.inputLabel}>Enter Phone Number</Text>
            <View style={styles.phoneInputContainer}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter 10 digit number"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                maxLength={10}
              />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={sendOTP} disabled={phoneLoading}>
              {phoneLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Send OTP via SMS</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.inputLabel}>Enter OTP</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="6-digit OTP"
              keyboardType="number-pad"
              value={verificationCode}
              onChangeText={setVerificationCode}
              maxLength={6}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={confirmOTP} disabled={phoneLoading}>
              {phoneLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Verify OTP</Text>}
            </TouchableOpacity>
          </>
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
