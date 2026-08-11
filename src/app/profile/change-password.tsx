import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { showAlert } from '@/utils/alert';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword) {
      showAlert('Error', 'Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      showAlert('Error', 'New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Error', 'New passwords do not match. Please type them carefully.');
      return;
    }

    // Since we're changing password, we need the Firebase User object
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      showAlert('Error', 'No authenticated user found. Please log in again.');
      return;
    }

    setLoading(true);
    try {
      // 1. Re-authenticate the user
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Update to new password
      await updatePassword(currentUser, newPassword);
      
      showAlert('Success', 'Your password has been changed successfully!');
      router.navigate('/profile');
    } catch (err: any) {
      // Map Firebase errors to user-friendly messages
      if (err.code === 'auth/invalid-credential') {
        showAlert('Error', 'The current password you entered is incorrect.');
      } else {
        showAlert('Error', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/profile')} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={{ padding: 20 }}>
        <Text style={styles.description}>
          To change your password, please enter your current password and your new desired password below.
        </Text>

        <Text style={styles.inputLabel}>Current Password</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Enter current password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            maxLength={50}
          />
        </View>

        <Text style={styles.inputLabel}>New Password</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Enter new password (min 6 chars)"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            maxLength={50}
          />
        </View>

        <Text style={styles.inputLabel}>Confirm New Password</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Re-enter new password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            maxLength={50}
          />
        </View>

        <TouchableOpacity 
          style={[styles.primaryButton, (loading || !currentPassword || newPassword.length < 6 || !confirmPassword) && styles.primaryButtonDisabled]} 
          onPress={handleChangePassword} 
          disabled={loading || !currentPassword || newPassword.length < 6 || !confirmPassword}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Update Password</Text>}
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
  description: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    marginBottom: 20,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: '#0F172A',
  },
  primaryButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonDisabled: {
    backgroundColor: '#A7F3D0',
  },
  primaryButtonText: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  }
});
