import { showAlert } from '@/utils/alert';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@/components/DateTimePicker';

export default function EditDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const setDebugLog = (log: any) => {}; // Dummy function to prevent errors from leftover debug calls

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (user) {
        setFetching(true);
        const fetchUserData = async () => {
          try {
            setDebugLog({ status: 'fetching', uid: user.uid });
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (isActive) {
              if (userDoc.exists()) {
                const data = userDoc.data();
                setDebugLog({ status: 'success', exists: true, data });
                let fetchedDob = data.dob || '';
                if (fetchedDob.includes('T')) {
                  const dateObj = new Date(fetchedDob);
                  if (!isNaN(dateObj.getTime())) {
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    fetchedDob = `${dateObj.getFullYear()}-${month}-${day}`;
                  }
                } else if (fetchedDob.includes('/')) {
                  const parts = fetchedDob.split('/');
                  if (parts.length === 3) {
                    fetchedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
                  }
                } else if (fetchedDob.includes('-') && fetchedDob.length === 10) {
                  const parts = fetchedDob.split('-');
                  // If it was somehow saved as DD-MM-YYYY
                  if (parts.length === 3 && parts[0].length !== 4) {
                    fetchedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
                  }
                }
                
                setName(data.name || data.firstName || user.displayName || '');
                setBio(data.bio || '');
                setDob(fetchedDob);
                setGender(data.gender || '');
                setLocalPhoto(data.avatar || user.photoURL || null);
              } else {
                setDebugLog({ status: 'success', exists: false, userDisplayName: user.displayName });
                setName(user.displayName || '');
                setLocalPhoto(user.photoURL || null);
              }
              setFetching(false);
            }
          } catch (e: any) {
            setDebugLog({ status: 'error', error: e.message || String(e) });
            if (isActive) setFetching(false);
          }
        };
        fetchUserData();
      } else {
        setFetching(false);
      }
      return () => {
        isActive = false;
      };
    }, [user])
  );

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        name,
        bio,
        dob,
        gender,
      }, { merge: true });
      if (Platform.OS !== 'web') {
        showAlert('Success', 'Profile updated successfully!');
      }
      router.navigate('/profile');
    } catch (e) {
      if (Platform.OS !== 'web') {
        showAlert('Error', 'Failed to update profile.');
      } else {
        showAlert("Notification", 'Failed to update profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.1, // 10% quality
        base64: true, // Request base64 string directly
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        // Size Check (5MB = 5 * 1024 * 1024 bytes)
        const fileSize = result.assets[0].fileSize;
        if (fileSize && fileSize > 5 * 1024 * 1024) {
          showAlert('File Too Large', 'Please select a photo smaller than 5 MB.');
          return;
        }

        setUploadingImage(true);
        
        try {
          setDebugLog({ status: 'processing_image' });
          
          // Create data URI from base64
          const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
          
          setDebugLog({ status: 'upload_step_saving_to_db' });
          if (user) {
            await updateProfile(user, { photoURL: base64Image });
            await updateDoc(doc(db, 'users', user.uid), { avatar: base64Image });
          }
          
          setDebugLog({ status: 'upload_success' });
          setLocalPhoto(base64Image);
          if (Platform.OS !== 'web') showAlert('Success', 'Profile photo updated!');
        } catch (innerError: any) {
          setDebugLog({ status: 'upload_failed', error: innerError.message || String(innerError) });
          if (Platform.OS !== 'web') showAlert('Error', 'Failed to update photo.');
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error: any) {
      setDebugLog({ status: 'picker_error', error: error.message || String(error) });
      setUploadingImage(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/profile')} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Details</Text>
        <View style={{ width: 44 }} />
      </View>

      {fetching ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={[styles.container, { overflow: 'visible' }]} contentContainerStyle={{ paddingBottom: 100, overflow: 'visible' }}>
          
          <View style={[styles.avatarSection, { zIndex: 1 }]}>
            {localPhoto && !String(localPhoto).includes('ui-avatars') ? (
              <Image source={{ uri: localPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.initialsAvatar]}>
                <Feather name="camera" size={32} color="#10B981" />
              </View>
            )}
            <TouchableOpacity 
              style={[styles.changePhotoButton, uploadingImage && { opacity: 0.5 }]} 
              onPress={pickImage}
              disabled={uploadingImage}
            >
              <Text style={styles.changePhotoText}>{uploadingImage ? 'Uploading...' : 'Change Photo'}</Text>
            </TouchableOpacity>
            <Text style={styles.photoHelper}>Image is highly compressed for fast loading</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rahul Kumar"
              placeholderTextColor="#9CA3AF"
              maxLength={50}
            />
          </View>

          <View style={[styles.inputGroup, { zIndex: 50 }]}>
            <Text style={styles.label}>Date of Birth</Text>
            <View style={[styles.input, { paddingHorizontal: 0, paddingVertical: 0, height: 52, zIndex: 50 }]}>
              <DateTimePicker
                type="date"
                value={dob}
                onChange={setDob}
                placeholder="Date of Birth"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderRow}>
              {['Male', 'Female', 'Other'].map((g) => (
                <TouchableOpacity 
                  key={g}
                  style={[styles.genderChip, gender === g && styles.genderChipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mini Bio (About You)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Hi! I travel often to my hometown and love listening to classic rock. Join me for a fun ride!"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={300}
            />
            <Text style={styles.helperText}>Write a little about yourself to build trust with others.</Text>
          </View>

          <TouchableOpacity 
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Details'}</Text>
          </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  container: {
    flex: 1,
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ECFDF5',
    marginBottom: 16,
  },
  initialsAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D1FAE5',
  },
  changePhotoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  changePhotoText: {
    fontFamily: 'Outfit_600SemiBold',
    color: '#4B5563',
    fontSize: 14,
  },
  photoHelper: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Outfit_600SemiBold',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    minHeight: 100,
  },
  helperText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  genderChipActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  genderText: {
    fontFamily: 'Outfit_600SemiBold',
    color: '#6B7280',
  },
  genderTextActive: {
    color: '#10B981',
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
});
